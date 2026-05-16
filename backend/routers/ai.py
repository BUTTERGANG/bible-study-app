"""Claude-backed study endpoints.

All endpoints stream Server-Sent Events. We gate them behind a rate limiter
(`ai_rate_limit`) and the optional shared-secret auth (`require_app_password`).
We also use prompt caching on the system prompt and any large passage context
so multi-turn conversations don't re-bill the same tokens.
"""

import json
import os
from typing import List, Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..auth import require_app_password
from ..rate_limit import ai_rate_limit

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


def _system_blocks(reference: Optional[str], translation: Optional[str]) -> list:
    """Build a cacheable system prompt. The expertise block (large, stable) is
    marked with ephemeral cache_control; the per-request line about the
    current passage is appended uncached."""
    blocks = [{"type": "text", "text": SYSTEM_PROMPT, "cache_control": _CACHE}]
    blocks.append({
        "type": "text",
        "text": f"\nThe user is currently studying {reference or 'the passage'} in {translation or 'KJV'}.",
    })
    return blocks


def _user_message_with_context(
    question: str,
    reference: Optional[str],
    translation: Optional[str],
    verse_text: Optional[str],
    chapter_text: Optional[str],
) -> dict:
    """User-turn message with optional passage context. The chapter_text — if
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
        # Only worth caching when there's meaningful content.
        if len(chapter_text) > 800:
            chapter_block["cache_control"] = _CACHE
        blocks.append(chapter_block)
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
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
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
async def ask_question(body: AskRequest):
    messages = list(body.conversation_history or [])
    messages.append(
        _user_message_with_context(
            body.question, body.reference, body.translation,
            body.verse_text, body.chapter_text,
        )
    )
    return _stream_response(
        lambda: _stream_text(
            system=_system_blocks(body.reference, body.translation),
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
