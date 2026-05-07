import os
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import anthropic

router = APIRouter(prefix="/api/ai", tags=["ai"])

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL = "claude-sonnet-4-6"

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
- Keep responses focused and practical for personal study

The user is studying [REFERENCE] in [TRANSLATION]."""


class AskRequest(BaseModel):
    question: str
    reference: Optional[str] = None
    translation: Optional[str] = "KJV"
    verse_text: Optional[str] = None
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


@router.post("/ask")
async def ask_question(body: AskRequest):
    context_ref = body.reference or "the passage"
    system = SYSTEM_PROMPT.replace("[REFERENCE]", context_ref).replace("[TRANSLATION]", body.translation or "KJV")

    messages = []
    if body.conversation_history:
        messages.extend(body.conversation_history)

    user_content = body.question
    if body.verse_text and body.reference:
        user_content = f"**{body.reference} ({body.translation})**\n> {body.verse_text}\n\n{body.question}"

    messages.append({"role": "user", "content": user_content})

    async def generate():
        with client.messages.stream(
            model=MODEL,
            max_tokens=2048,
            system=system,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/explain")
async def explain_passage(body: ExplainRequest):
    verses_text = "\n".join(
        f"{v['verse']}. {v['text']}" for v in body.verses
    )
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

    async def generate():
        with client.messages.stream(
            model=MODEL,
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


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

    async def generate():
        with client.messages.stream(
            model=MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


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

    async def generate():
        with client.messages.stream(
            model=MODEL,
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/outline")
async def generate_outline(
    reference: str,
    translation: str = "KJV",
):
    prompt = f"""Create a detailed study outline for {reference} ({translation}).

Format as a structured outline with:
- Main sections (Roman numerals)
- Sub-points (letters)
- Key verse references for each point
- Brief teaching note for each section

Make it suitable for personal Bible study or small group teaching."""

    response = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    return {"outline": response.content[0].text, "reference": reference}


@router.post("/cross-references")
async def find_cross_references(reference: str, verse_text: str):
    prompt = f"""For this verse: **{reference}** — "{verse_text}"

List 10 of the most theologically significant cross-references. For each:
- Reference (Book Chapter:Verse)
- Brief note explaining the connection
- Type of connection (prophecy/fulfillment, parallel teaching, contrast, etc.)

Format as a clean list."""

    response = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    return {"cross_references": response.content[0].text, "reference": reference}
