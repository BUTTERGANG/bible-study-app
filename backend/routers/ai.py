"""Claude-backed study endpoints.

All endpoints stream Server-Sent Events. We gate them behind a rate limiter
(`ai_rate_limit`) and the optional shared-secret auth (`require_app_password`).
We also use prompt caching on the system prompt and any large passage context
so multi-turn conversations don't re-bill the same tokens.
"""

import json
import logging
import os
from typing import List, Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_app_password
from ..database import get_db
from ..models import BibleVerse, LibraryBook, LibraryPage, LibrarySummary
from ..rate_limit import ai_rate_limit

logger = logging.getLogger("bible-study.ai")

router = APIRouter(
    prefix="/api/ai",
    tags=["ai"],
    dependencies=[Depends(require_app_password), Depends(ai_rate_limit)],
)

MODEL = "claude-sonnet-4-6"
_CACHE = {"type": "ephemeral"}

_async_client: Optional[anthropic.AsyncAnthropic] = None


def _client() -> anthropic.AsyncAnthropic:
    """Return the async Anthropic client, raising 503 if no key is configured.
    Lazy-initialized so a missing key only fails the AI endpoints, not startup."""
    global _async_client
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not set. Add it in Replit Secrets to enable AI features.",
        )
    if _async_client is None:
        _async_client = anthropic.AsyncAnthropic(api_key=api_key)
    return _async_client


SYSTEM_PROMPT = """You are a knowledgeable Bible study assistant with deep expertise in:
- Biblical theology and exegesis
- Ancient Near Eastern history and culture
- Biblical Hebrew and Greek
- Church history and patristics
- Systematic theology across traditions (Reformed, Lutheran, Catholic, Anglican, etc.)
- Textual criticism and manuscript traditions

When answering questions:
- Cite specific Bible verses using standard notation (Book Chapter:Verse)
- Reference multiple scholarly perspectives when relevant
- Explain historical and cultural context
- Note connections between Old and New Testaments
- Be clear about where there is scholarly consensus vs. interpretive debate
- Keep responses focused and practical for personal study"""


class AskRequest(BaseModel):
    question: str
    reference: Optional[str] = None
    translation: Optional[str] = "KJV"
    verse_text: Optional[str] = None
    chapter_text: Optional[str] = None
    conversation_history: Optional[List[dict]] = None
    include_library_context: bool = True


class ExplainRequest(BaseModel):
    reference: str
    translation: str = "KJV"
    verses: List[dict]
    focus: Optional[str] = None


class WordStudyRequest(BaseModel):
    word: str
    reference: str
    original: Optional[str] = None
    strongs: Optional[str] = None


class TopicStudyRequest(BaseModel):
    topic: str
    depth: str = "overview"


class OutlineRequest(BaseModel):
    reference: str
    translation: str = "KJV"


class CrossRefRequest(BaseModel):
    reference: str
    verse_text: str


class SermonRequest(BaseModel):
    passage: str
    audience: Optional[str] = "general"
    key_themes: Optional[List[str]] = None
    translation: Optional[str] = "KJV"
    verse_text: Optional[str] = None
    chapter_text: Optional[str] = None


async def _fetch_library_context(db: AsyncSession, question: str, limit: int = 3) -> list:
    """Search library pages via FTS5 and return top relevant passages.
    Degrades gracefully if library has no pages or FTS5 is unavailable."""
    try:
        # Use up to the first 10 words to keep the FTS5 query clean
        safe_q = question.replace('"', '""')
        query_words = " ".join(safe_q.split()[:10])
        if not query_words:
            return []
        rows = await db.execute(
            text("""
                SELECT
                    lb.title,
                    lb.author,
                    lp.book_id,
                    lp.page_num,
                    snippet(library_pages_fts, 0, '', '', '…', 40) AS snippet
                FROM library_pages_fts
                JOIN library_pages lp ON lp.id = library_pages_fts.rowid
                JOIN library_books lb ON lb.id = lp.book_id
                WHERE library_pages_fts MATCH :q
                ORDER BY rank
                LIMIT :limit
            """),
            {"q": f'"{query_words}"', "limit": limit},
        )
        return [
            {
                "title": r.title,
                "author": r.author or "",
                "book_id": r.book_id,
                "page": r.page_num,
                "snippet": r.snippet or "",
            }
            for r in rows
        ]
    except Exception:
        return []


def _system_blocks(reference: Optional[str], translation: Optional[str], has_library: bool = False) -> list:
    """Build a cacheable system prompt. The expertise block (large, stable) is
    marked with ephemeral cache_control; the per-request line about the
    current passage is appended uncached."""
    blocks = [{"type": "text", "text": SYSTEM_PROMPT, "cache_control": _CACHE}]
    passage_note = f"\nThe user is currently studying {reference or 'the passage'} in {translation or 'KJV'}."
    if has_library:
        passage_note += (
            " Relevant passages from their personal library have been included as context below. "
            "When drawing on library content, cite the source inline as [Source: Book Title, p.N]."
        )
    blocks.append({"type": "text", "text": passage_note})
    return blocks


def _user_message_with_context(
    question: str,
    reference: Optional[str],
    translation: Optional[str],
    verse_text: Optional[str],
    chapter_text: Optional[str],
    library_context: Optional[list] = None,
) -> dict:
    """User-turn message with optional passage and library context. The chapter_text — if
    present and long — gets its own cache point so subsequent turns about the
    same chapter reuse it."""
    blocks: list = []
    if verse_text and reference:
        blocks.append({
            "type": "text",
            "text": f"**{reference} ({translation})**\n> {verse_text}",
        })
    if chapter_text:
        chapter_block = {"type": "text", "text": f"Full chapter context:\n{chapter_text}"}
        if len(chapter_text) > 800:
            chapter_block["cache_control"] = _CACHE
        blocks.append(chapter_block)
    if library_context:
        lib_lines = ["**Relevant passages from your library:**\n"]
        for i, item in enumerate(library_context, 1):
            author_note = f" by {item['author']}" if item["author"] else ""
            lib_lines.append(f"[{i}] *{item['title']}{author_note}* (p.{item['page']}):\n{item['snippet']}")
        blocks.append({"type": "text", "text": "\n\n".join(lib_lines)})
    blocks.append({"type": "text", "text": question})
    return {"role": "user", "content": blocks}


def _stream_response(coro_factory):
    """Wrap an async-stream factory into an SSE StreamingResponse with a
    consistent error envelope. Errors are sent as a single SSE event so the
    frontend can render them inline instead of getting a half-baked bubble."""

    async def generate():
        try:
            async for text in coro_factory():
                yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except HTTPException as e:
            yield f"data: {json.dumps({'error': e.detail})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception:
            # Never leak raw exception strings to the client — they may contain
            # API keys, file paths, or internal details.
            logger.exception("AI stream error")
            yield f"data: {json.dumps({'error': 'An internal error occurred. Please try again.'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


async def _stream_text(*, system, messages: list, max_tokens: int):
    client = _client()
    kwargs = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system is not None:
        kwargs["system"] = system
    async with client.messages.stream(**kwargs) as stream:
        async for text in stream.text_stream:
            yield text


@router.post("/ask")
async def ask_question(body: AskRequest, db: AsyncSession = Depends(get_db)):
    library_context = []
    if body.include_library_context:
        library_context = await _fetch_library_context(db, body.question)

    messages = list(body.conversation_history or [])
    messages.append(
        _user_message_with_context(
            body.question, body.reference, body.translation,
            body.verse_text, body.chapter_text,
            library_context or None,
        )
    )
    return _stream_response(
        lambda: _stream_text(
            system=_system_blocks(body.reference, body.translation, has_library=bool(library_context)),
            messages=messages,
            max_tokens=2048,
        )
    )


@router.post("/explain")
async def explain_passage(body: ExplainRequest):
    verses_text = "\n".join(f"{v['verse']}. {v['text']}" for v in body.verses)
    focus_note = f"\nFocus especially on: {body.focus}" if body.focus else ""

    prompt = f"""Please provide a thorough study commentary on {body.reference} ({body.translation}):

{verses_text}
{focus_note}

Include:
1. **Overview**: Main theme and message of this passage
2. **Historical/Cultural Context**: What readers in the original audience would have understood
3. **Key Verses**: Focus on the most significant verse(s)
4. **Theological Themes**: Major theological ideas present
5. **Cross-References**: 3-5 key parallel passages
6. **Application**: How this applies to daily life and faith"""

    return _stream_response(
        lambda: _stream_text(
            system=None,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3000,
        )
    )


@router.post("/word-study")
async def word_study(body: WordStudyRequest):
    strongs_note = f" (Strong's {body.strongs})" if body.strongs else ""
    original_note = f" — original: {body.original}" if body.original else ""

    prompt = f"""Conduct a thorough word study on the word "{body.word}"{original_note}{strongs_note} as used in {body.reference}.

Provide:
1. **Etymology**: Root meaning and origin of the word
2. **Definition**: Precise meaning in this context vs. semantic range
3. **Usage in Scripture**: Key passages where this word appears (list 5-8)
4. **Theological Significance**: Why this specific word matters here
5. **Translation History**: How major translations render this word
6. **Practical Insight**: What this word study reveals for understanding the passage"""

    return _stream_response(
        lambda: _stream_text(
            system=None,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
        )
    )


@router.post("/topic-study")
async def topic_study(body: TopicStudyRequest):
    depth_instructions = {
        "overview": "Provide a 500-word overview with 8-10 key verses.",
        "detailed": "Provide a detailed study with 15-20 verses organized thematically.",
        "comprehensive": "Provide a comprehensive systematic study covering all major aspects.",
    }
    depth_note = depth_instructions.get(body.depth, depth_instructions["overview"])

    prompt = f"""Create a topical Bible study on: **{body.topic}**

{depth_note}

Structure:
1. **Introduction**: Define the topic and its biblical importance
2. **Old Testament Foundation**: Key OT teachings and examples
3. **New Testament Development**: How the NT expands/fulfills the OT teaching
4. **Key Passages**: Most important verses to study, with brief commentary
5. **Theological Summary**: Systematic summary of the biblical teaching
6. **Practical Application**: How to apply this teaching today"""

    return _stream_response(
        lambda: _stream_text(
            system=None,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3000,
        )
    )


@router.post("/outline")
async def generate_outline(body: OutlineRequest):
    prompt = f"""Create a detailed study outline for {body.reference} ({body.translation}).

Format as a structured outline with:
- Main sections (Roman numerals)
- Sub-points (letters)
- Key verse references for each point
- Brief teaching note for each section

Make it suitable for personal Bible study or small group teaching."""

    client = _client()
    response = await client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    return {"outline": response.content[0].text, "reference": body.reference}


@router.post("/cross-references")
async def find_cross_references(body: CrossRefRequest):
    prompt = f"""For this verse: **{body.reference}** — "{body.verse_text}"

List 10 of the most theologically significant cross-references. For each:
- Reference (Book Chapter:Verse)
- Brief note explaining the connection
- Type of connection (prophecy/fulfillment, parallel teaching, contrast, etc.)

Format as a clean list."""

    client = _client()
    response = await client.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    return {"cross_references": response.content[0].text, "reference": body.reference}


class SermonSectionRequest(BaseModel):
    passage: str
    translation: str = "KJV"
    audience: Optional[str] = "general"
    outline: Optional[str] = None  # existing outline for context


@router.post("/illustrations")
async def generate_illustrations(body: SermonSectionRequest):
    audience_desc = SERMON_AUDIENCE_GUIDE.get(body.audience, SERMON_AUDIENCE_GUIDE["general"]) if body.audience else "a general congregation"
    outline_note = f"\n\nThe sermon outline so far:\n{body.outline}" if body.outline else ""

    prompt = f"""Generate 3 compelling sermon illustrations for **{body.passage}** ({body.translation}), suitable for {audience_desc}.{outline_note}

For each illustration provide:
### Illustration [N]: [Short Title]
**Type:** (story / analogy / historical example / contemporary example)
**Tone:** (inspirational / convicting / comforting / challenging)
**Content:** A vivid, 100-150 word illustration ready to use from the pulpit.
**Bridge:** One sentence connecting the illustration back to the passage.

Make the illustrations relatable, memorable, and theologically grounded."""

    return _stream_response(
        lambda: _stream_text(system=None, messages=[{"role": "user", "content": prompt}], max_tokens=1500)
    )


class DiscussionQuestionsRequest(BaseModel):
    passage: str
    translation: str = "KJV"
    context: str = "small_group"  # small_group | sermon_prep | personal
    difficulty: str = "growing"   # new_believer | growing | mature


_DQ_CONTEXT_DESC = {
    "small_group": "a small group Bible study",
    "sermon_prep": "sermon preparation and teaching",
    "personal": "personal devotional study",
}

_DQ_DIFFICULTY_DESC = {
    "new_believer": "new believers who are just starting to explore the Bible — use simple language and avoid assumed theological knowledge",
    "growing": "Christians who are growing in their faith and have basic Bible familiarity",
    "mature": "mature believers with theological depth who can engage with nuanced interpretation and application",
}


@router.post("/discussion-questions")
async def generate_discussion_questions(body: DiscussionQuestionsRequest):
    context_desc = _DQ_CONTEXT_DESC.get(body.context, _DQ_CONTEXT_DESC["small_group"])
    difficulty_desc = _DQ_DIFFICULTY_DESC.get(body.difficulty, _DQ_DIFFICULTY_DESC["growing"])

    prompt = f"""Generate 8 discussion questions for **{body.passage}** ({body.translation}) tailored for {context_desc} with {difficulty_desc}.

Organize the questions into four categories, two questions each:

## Opening Questions
*(Help the group engage with the text — observation, first impressions)*

**O1. [Question]**
*Purpose: [brief note on what this surfaces]*

**O2. [Question]**
*Purpose: [brief note on what this surfaces]*

## Exploration Questions
*(Dig into meaning, context, and interpretation)*

**E1. [Question]**
*Purpose: [brief note on what this surfaces]*

**E2. [Question]**
*Purpose: [brief note on what this surfaces]*

## Application Questions
*(Connect the passage to everyday life and action)*

**A1. [Question]**
*Purpose: [brief note on what this surfaces]*

**A2. [Question]**
*Purpose: [brief note on what this surfaces]*

## Reflection Questions
*(Personal response, prayer, and ongoing transformation)*

**R1. [Question]**
*Purpose: [brief note on what this surfaces]*

**R2. [Question]**
*Purpose: [brief note on what this surfaces]*

Keep all questions open-ended. Calibrate depth and vocabulary to the audience described."""

    return _stream_response(
        lambda: _stream_text(system=None, messages=[{"role": "user", "content": prompt}], max_tokens=1400)
    )


@router.post("/application-questions")
async def generate_application_questions(body: DiscussionQuestionsRequest):
    context_desc = _DQ_CONTEXT_DESC.get(body.context, _DQ_CONTEXT_DESC["small_group"])
    difficulty_desc = _DQ_DIFFICULTY_DESC.get(body.difficulty, _DQ_DIFFICULTY_DESC["growing"])

    prompt = f"""Generate 6 application-focused questions for **{body.passage}** ({body.translation}) for {context_desc} with {difficulty_desc}.

These questions should move people from understanding to action. For each question:

**Q[N]. [Question]**
- **This week:** One concrete step the person can take in the next 7 days
- *Purpose: [what growth this targets]*

Cover these angles:
1. A personal conviction or attitude to examine
2. A relationship or community to invest in
3. A habit or spiritual discipline to begin or strengthen
4. A way to serve others based on this passage
5. A truth to memorize or meditate on
6. An area of surrender or trust to grow in

Calibrate depth and expectations to the audience described."""

    return _stream_response(
        lambda: _stream_text(system=None, messages=[{"role": "user", "content": prompt}], max_tokens=1200)
    )


@router.post("/applications")
async def generate_applications(body: SermonSectionRequest):
    audience_desc = SERMON_AUDIENCE_GUIDE.get(body.audience, SERMON_AUDIENCE_GUIDE["general"]) if body.audience else "a general congregation"
    outline_note = f"\n\nBased on this outline:\n{body.outline}" if body.outline else ""

    prompt = f"""Generate 4 practical life applications from **{body.passage}** ({body.translation}) for {audience_desc}.{outline_note}

For each application:
### Application [N]: [Action-Oriented Title]
**The Principle:** One sentence stating the biblical principle.
**This Week:** A specific, concrete action the listener can take in the next 7 days.
**Long-term:** A habit or posture to develop over the next 30 days.
**Reflection question:** One question to carry through the week.

Make applications specific, measurable, and spiritually transformative — not generic."""

    return _stream_response(
        lambda: _stream_text(system=None, messages=[{"role": "user", "content": prompt}], max_tokens=1200)
    )


SERMON_AUDIENCE_GUIDE = {
    "general": "a general congregation of mixed ages and backgrounds",
    "youth": "teenagers and young adults (ages 13-22)",
    "men": "a men's group or men's Bible study",
    "women": "a women's group or women's Bible study",
    "seniors": "an older, mature congregation",
    "seekers": "people exploring Christianity for the first time",
}


@router.post("/sermon")
async def generate_sermon(body: SermonRequest):
    audience_desc = SERMON_AUDIENCE_GUIDE.get(body.audience, SERMON_AUDIENCE_GUIDE["general"])
    themes_line = ""
    if body.key_themes:
        themes_line = f"\nKey themes to emphasize: {', '.join(body.key_themes)}"

    context_blocks = []
    if body.verse_text:
        context_blocks.append(f"**{body.passage} ({body.translation})**\n> {body.verse_text}")
    if body.chapter_text:
        context_blocks.append(f"Full chapter context:\n{body.chapter_text}")

    context_section = ""
    if context_blocks:
        context_section = "\n\n---\nSCRIPTURE CONTEXT:\n" + "\n\n".join(context_blocks) + "\n---"

    prompt = f"""You are an experienced pastor and sermon preparation assistant. Create a complete, ready-to-deliver sermon on **{body.passage}** for {audience_desc}.{themes_line}{context_section}

Structure the sermon as follows (use markdown formatting):

## Sermon Title
A compelling, memorable title for this sermon.

## Introduction
- A hook or opening illustration that grabs attention
- Bridge from the hook to the text
- Thesis statement: the main point of the sermon

## Main Points

### Point 1: [Title]
- **Key Verse(s):** [supporting references]
- **Explanation:** Clear explanation of the biblical teaching
- **Illustration:** A story, analogy, or real-life example
- **Application:** How this applies to daily life

### Point 2: [Title]
- **Key Verse(s):** [supporting references]
- **Explanation:** Clear explanation of the biblical teaching
- **Illustration:** A story, analogy, or real-life example
- **Application:** How this applies to daily life

### Point 3: [Title]
- **Key Verse(s):** [supporting references]
- **Explanation:** Clear explanation of the biblical teaching
- **Illustration:** A story, analogy, or real-life example
- **Application:** How this applies to daily life

(Add Point 4 and Point 5 if the passage warrants it)

## Discussion Questions
Provide 4-6 thought-provoking questions for small group discussion or personal reflection:
1. ...
2. ...
3. ...

## Conclusion
- Summary of the main message
- A call to action or response
- A closing illustration or story
- A prayer or benediction

## Additional Illustrations
2-3 extra illustrations or stories that could be swapped in or used for a different audience.

Make the sermon practical, biblically faithful, and engaging. Write as if the pastor will read or preach this directly. Use warm, pastoral language."""

    system_blocks = _system_blocks(body.passage, body.translation)
    system_blocks.append({
        "type": "text",
        "text": f"\nThe user is requesting a sermon for {audience_desc} on {body.passage}.",
    })

    return _stream_response(
        lambda: _stream_text(
            system=system_blocks,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
        )
    )


class InsightsRequest(BaseModel):
    book: str
    chapter: int
    verse: int
    translation: str = "KJV"


@router.post("/insights")
async def passage_insights(body: InsightsRequest, db: AsyncSession = Depends(get_db)):
    """Return a quick JSON insights card: 2-sentence summary + key people, places, themes."""
    result = await db.execute(
        select(BibleVerse).where(
            BibleVerse.book == body.book,
            BibleVerse.chapter == body.chapter,
            BibleVerse.verse == body.verse,
            BibleVerse.translation == body.translation,
        )
    )
    verse_row = result.scalar_one_or_none()
    verse_text = verse_row.text if verse_row else ""

    chapter_rows = await db.execute(
        select(BibleVerse).where(
            BibleVerse.book == body.book,
            BibleVerse.chapter == body.chapter,
            BibleVerse.translation == body.translation,
        ).order_by(BibleVerse.verse)
    )
    chapter_text = " ".join(r.text for r in chapter_rows.scalars().all())[:2000]

    reference = f"{body.book} {body.chapter}:{body.verse}"
    prompt = f"""You are a biblical scholar. Analyze this passage and respond ONLY with a JSON object — no markdown, no explanation.

Reference: {reference} ({body.translation})
Verse: {verse_text}
Chapter context (first 2000 chars): {chapter_text}

Return exactly this JSON shape:
{{
  "summary": "Two sentences of concise contextual insight about this verse within its chapter.",
  "key_people": ["Person 1", "Person 2"],
  "key_places": ["Place 1", "Place 2"],
  "key_themes": ["Theme 1", "Theme 2", "Theme 3"]
}}

Rules:
- summary: exactly 2 sentences, insightful not generic
- key_people: 0-4 named individuals from the passage (empty array if none)
- key_places: 0-4 geographic locations mentioned (empty array if none)
- key_themes: 2-4 theological or thematic concepts
- All arrays: strings only, no objects"""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        data = json.loads(raw[start:end]) if start != -1 else {}

    return {
        "reference": reference,
        "summary": data.get("summary", ""),
        "key_people": data.get("key_people", []),
        "key_places": data.get("key_places", []),
        "key_themes": data.get("key_themes", []),
    }


class SearchSynopsisRequest(BaseModel):
    query: str
    results: List[dict]  # [{reference, text/snippet, ...}]


@router.post("/search-synopsis")
async def search_synopsis(body: SearchSynopsisRequest):
    """Stream a 1-2 sentence AI synthesis of what the top search results share."""
    if not body.results:
        return _stream_response(lambda: (x for x in []))

    snippets = "\n".join(
        f"- {r.get('reference', '')}: {(r.get('text') or r.get('snippet') or '')[:120]}"
        for r in body.results[:8]
    )
    prompt = f"""A user searched for: "{body.query}"

Top matching Bible passages:
{snippets}

Write 1-2 sentences synthesizing what these passages have in common and what they reveal about "{body.query}". Be specific and insightful. Do not use filler phrases like "These verses show..." — start directly with the insight."""

    return _stream_response(
        lambda: _stream_text(
            system=None,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
        )
    )


class StudyObservationsRequest(BaseModel):
    reference: str
    translation: str = "KJV"
    verse_text: Optional[str] = None


@router.post("/study-observations")
async def study_observations(body: StudyObservationsRequest):
    """Generate inductive-study observations for a passage (streaming)."""
    verse_note = f"\n\nVerse text: {body.verse_text}" if body.verse_text else ""
    prompt = f"""Perform an inductive Bible study on **{body.reference}** ({body.translation}).{verse_note}

Answer these three questions in detail using markdown:

## Observation — What does it say?
List 6-8 key observations about the text. What stands out? Who, what, where, when, why, how?

## Interpretation — What does it mean?
Explain the meaning in historical, cultural, and theological context. What was the original author communicating?

## Application — How does it apply?
Provide 3-4 practical ways this passage applies to a modern believer's life."""

    return _stream_response(
        lambda: _stream_text(
            system=None,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
        )
    )


# ---------------------------------------------------------------------------
# Resource Summarizer
# ---------------------------------------------------------------------------

SUMMARY_SYSTEM_PROMPT = """You are a knowledgeable Bible study assistant and theological librarian.
Your task is to summarize books, commentaries, and articles from a user's personal library.
Provide clear, structured summaries that help the reader quickly grasp the content.

Always structure your response as follows. Be substantive — avoid generic filler;
draw out the actual arguments and themes of the work."""


class SummarizeRequest(BaseModel):
    resource_id: int
    chunk_size: int = 0  # 0 = auto (chunk if >100 pages)
    summary_length: str = "standard"  # "brief" | "standard" | "detailed"


_CHUNK_THRESHOLD = 100  # pages — above this, we chunk
_CHUNK_SIZE_PAGES = 50  # pages per chunk


async def _fetch_book_pages(db: AsyncSession, book_id: int, page_start: int = 0, page_end: int = 0) -> tuple:
    """Fetch book metadata and page text. Returns (book, concatenated_text)."""
    book_result = await db.execute(select(LibraryBook).where(LibraryBook.id == book_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    pages_query = select(LibraryPage).where(LibraryPage.book_id == book_id)
    if page_start > 0:
        pages_query = pages_query.where(LibraryPage.page_num >= page_start)
    if page_end > 0:
        pages_query = pages_query.where(LibraryPage.page_num <= page_end)
    pages_query = pages_query.order_by(LibraryPage.page_num)

    pages_result = await db.execute(pages_query)
    pages = pages_result.scalars().all()
    if not pages:
        raise HTTPException(status_code=404, detail="No pre-extracted pages found for this book")

    text = "\n\n".join(f"[Page {p.page_num}]\n{p.text}" for p in pages)
    return book, text


async def _get_cached_summary(db: AsyncSession, book_id: int, chunk_size: int):
    """Return a cached summary if one exists."""
    result = await db.execute(
        select(LibrarySummary).where(
            LibrarySummary.book_id == book_id,
            LibrarySummary.chunk_size == chunk_size,
        )
    )
    return result.scalar_one_or_none()


async def _save_summary(
    db: AsyncSession,
    book_id: int,
    chunk_size: int,
    tldr: str,
    key_points: list,
    outline: str,
) -> None:
    """Persist a summary to the database (upsert semantics)."""
    from datetime import datetime as _dt

    existing = await db.execute(
        select(LibrarySummary).where(
            LibrarySummary.book_id == book_id,
            LibrarySummary.chunk_size == chunk_size,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        row.tldr = tldr
        row.key_points = json.dumps(key_points)
        row.outline = outline
        row.generated_at = _dt.utcnow()
    else:
        row = LibrarySummary(
            book_id=book_id,
            chunk_size=chunk_size,
            tldr=tldr,
            key_points=json.dumps(key_points),
            outline=outline,
        )
        db.add(row)
    await db.commit()


@router.post("/summarize")
async def summarize_resource(body: SummarizeRequest, db: AsyncSession = Depends(get_db)):
    """Stream an AI-generated summary of a library book.

    Accepts resource_id and optional chunk_size (pages per chunk).
    If chunk_size is 0, auto-decides based on book length.
    Emits SSE events:
      {"stage": "status", "message": "..."}  -- progress updates
      {"stage": "tldr", "text": "..."}       -- the tldr section
      {"stage": "key_points", "text": "..."}  -- the key points section (JSON array string)
      {"stage": "outline", "text": "..."}     -- the outline section (markdown)
      {"stage": "done"}                       -- finished
      {"error": "..."}                        -- on failure (then [DONE])
    """
    book_result = await db.execute(select(LibraryBook).where(LibraryBook.id == body.resource_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    chunk_size = body.chunk_size

    async def generate():
        try:
            # Check cache first
            cached = await _get_cached_summary(db, body.resource_id, chunk_size)
            if cached:
                yield f"data: {json.dumps({'stage': 'status', 'message': 'Loading cached summary…'})}\n\n"
                yield f"data: {json.dumps({'stage': 'tldr', 'text': cached.tldr})}\n\n"
                kp = json.loads(cached.key_points) if cached.key_points else []
                yield f"data: {json.dumps({'stage': 'key_points', 'text': json.dumps(kp)})}\n\n"
                yield f"data: {json.dumps({'stage': 'outline', 'text': cached.outline})}\n\n"
                yield f"data: {json.dumps({'stage': 'done', 'cached': True})}\n\n"
                yield "data: [DONE]\n\n"
                return

            # Determine chunking strategy
            total_pages = book.page_count or 0
            if chunk_size == 0 and total_pages > _CHUNK_THRESHOLD:
                chunk_size = _CHUNK_SIZE_PAGES

            if chunk_size > 0 and total_pages > 0:
                chunks = []
                for start in range(1, total_pages + 1, chunk_size):
                    end = min(start + chunk_size - 1, total_pages)
                    chunks.append((start, end))
                yield f"data: {json.dumps({'stage': 'status', 'message': f'Summarizing {book.title} in {len(chunks)} parts ({total_pages} pages)…'})}\n\n"
            else:
                chunks = [(0, 0)]  # full book, no chunking
                yield f"data: {json.dumps({'stage': 'status', 'message': f'Summarizing {book.title} ({total_pages} pages)…'})}\n\n"

            all_tldrs = []
            all_key_points = []
            all_outlines = []

            for idx, (p_start, p_end) in enumerate(chunks):
                if len(chunks) > 1:
                    yield f"data: {json.dumps({'stage': 'status', 'message': f'Processing part {idx + 1}/{len(chunks)} (pages {p_start}-{p_end})…'})}\n\n"

                book_meta, text = await _fetch_book_pages(db, body.resource_id, p_start, p_end)
                if not text.strip():
                    continue

                # Truncate very long texts to respect context window (~4 chars/token)
                max_chars = 180_000
                if len(text) > max_chars:
                    text = text[:max_chars] + "\n\n[Content truncated due to length…]"

                author_note = f" by {book_meta.author}" if book_meta.author else ""
                page_range = f" (pages {p_start}-{p_end})" if p_start > 0 else ""

                prompt = f"""Summarize the following content from the book **{book_meta.title}**{author_note}{page_range}.

Content:
---

{text}

---

Provide a structured summary with:

## TL;DR
Write 2-3 sentences summarizing the entire content at a high level.

## Key Points
List 5-10 key takeaways as bullet points. Each should be a single substantive sentence capturing a major argument, theme, or insight.

## Outline
Provide a structured outline of the content using ## headings and - sub-points. Capture the logical flow of the work."""

                client = _client()
                accumulated = ""
                async with client.messages.stream(
                    model=MODEL,
                    max_tokens=3000,
                    system=[{"type": "text", "text": SUMMARY_SYSTEM_PROMPT, "cache_control": _CACHE}],
                    messages=[{"role": "user", "content": prompt}],
                ) as stream:
                    async for chunk_text in stream.text_stream:
                        accumulated += chunk_text

                # Parse the markdown response
                tldr = ""
                key_points = []
                outline = ""

                sections = accumulated.split("## ")
                for section in sections:
                    section = section.strip()
                    if not section:
                        continue
                    lines = section.split("\n", 1)
                    heading = lines[0].strip().lower()
                    body = lines[1].strip() if len(lines) > 1 else ""

                    if "tldr" in heading or "tl;dr" in heading:
                        tldr = body.strip()
                    elif "key point" in heading:
                        for line in body.split("\n"):
                            line = line.strip()
                            if line.startswith("- ") or line.startswith("* "):
                                key_points.append(line[2:].strip())
                            elif line and not line.startswith("#"):
                                key_points.append(line)
                    elif "outline" in heading:
                        outline = body.strip()

                # Fallback: if parsing failed, use the whole response
                if not tldr and not key_points and not outline:
                    tldr = accumulated.strip()[:500]
                    outline = accumulated.strip()

                if tldr:
                    all_tldrs.append(tldr)
                if key_points:
                    all_key_points.extend(key_points)
                if outline:
                    all_outlines.append(outline)

            # Combine chunk results
            final_tldr = " ".join(all_tldrs) if all_tldrs else "No summary generated."
            # Deduplicate key points while preserving order
            seen = set()
            deduped_kp = []
            for kp in all_key_points:
                kp_clean = kp.strip()
                if kp_clean and kp_clean not in seen:
                    seen.add(kp_clean)
                    deduped_kp.append(kp_clean)
            final_outline = "\n\n".join(all_outlines) if all_outlines else "No outline generated."

            # Cache the combined result
            await _save_summary(db, body.resource_id, chunk_size, final_tldr, deduped_kp, final_outline)

            # Stream the final result
            yield f"data: {json.dumps({'stage': 'tldr', 'text': final_tldr})}\n\n"
            yield f"data: {json.dumps({'stage': 'key_points', 'text': json.dumps(deduped_kp)})}\n\n"
            yield f"data: {json.dumps({'stage': 'outline', 'text': final_outline})}\n\n"
            yield f"data: {json.dumps({'stage': 'done', 'cached': False})}\n\n"
            yield "data: [DONE]\n\n"

        except HTTPException:
            raise
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
