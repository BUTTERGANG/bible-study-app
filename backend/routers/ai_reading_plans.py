"""AI-generated reading-plan generation.

POST /api/ai/reading-plan  — Claude designs a structured reading plan from a
natural-language goal. Streams SSE: {"stage":"generating"} -> {"stage":"plan","plan":{...}} -> {"stage":"done"}.

The previewed plan is persisted by calling POST /api/reading-plans/start-ai
with the returned JSON.
"""

import json
import re
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..bible_data import BOOKS
from ..database import get_db
from ..models import ReadingPlan
from .ai import MODEL, _client as _ai_client, _CACHE, ai_rate_limit

router = APIRouter(
    prefix="/api/ai/reading-plan",
    tags=["ai-reading-plans"],
    dependencies=[Depends(get_current_user), Depends(ai_rate_limit)],
)


def _build_book_list() -> str:
    lines = []
    current_testament = None
    for b in BOOKS:
        if b["testament"] != current_testament:
            lines.append(f"\n[{b['testament']}]")
            current_testament = b["testament"]
        lines.append(f"  {b['name']} - {b['chapters']} chapters")
    return "\n".join(lines)


_SYSTEM_BLOCKS = None


def _system_blocks():
    global _SYSTEM_BLOCKS
    if _SYSTEM_BLOCKS is not None:
        return _SYSTEM_BLOCKS
    book_list = _build_book_list()
    prompt = f"""You are a Bible reading plan designer. Your expertise covers the structure and content of all 66 canonical Bible books, major biblical themes, and principles of balanced spiritual reading.

The canonical Bible books are:
{book_list}

When designing a reading plan you must:
- Assign specific, real Bible references (e.g. "Genesis 3", "John 1:1-18", "Psalms 1-3", "Romans 8:1-17")
- Balance chapter lengths across days so no day is overwhelming
- Group related passages together (same narrative, same epistle, same theme)
- Include contextually appropriate readings (don't break a narrative mid-paragraph)
- For books with many short chapters (Psalms, Amos, etc.), include multiple per day
- For very long chapters (Psalm 119, Jeremiah 52), consider splitting
- Every reference must be a real passage from the 66 canonical books

Generate ONLY a valid JSON object - no markdown fences. No explanation before or after. Output JSON only."""
    _SYSTEM_BLOCKS = [{"type": "text", "text": prompt, "cache_control": _CACHE}]
    return _SYSTEM_BLOCKS


class ReadingPlanRequest(BaseModel):
    goal: str
    plan_name: Optional[str] = None
    duration_days: Optional[int] = None


def _user_prompt(body: ReadingPlanRequest) -> str:
    parts = [f'Design a Bible reading plan based on this goal:\n"{body.goal}"']
    if body.plan_name:
        parts.append(f"The user named it: {body.plan_name}")
    if body.duration_days:
        parts.append(f"The user requested {body.duration_days} days.")
    parts.append("""Return ONLY this JSON shape (no markdown fences):
{
  "plan_name": "<concise, memorable plan title>",
  "goal": "<restate what the plan covers>",
  "duration_days": <number_of_days>,
  "days": [
    {
      "day": 1,
      "day_label": "Day 1",
      "passages": ["Genesis 1", "Genesis 2"],
      "description": "Creation - God makes the heavens, the earth, and humanity"
    }
  ]
}

Rules:
- duration_days == days.length
- Each passages entry must be valid: "Book Chapter" or "Book Chapter:VerseStart-VerseEnd" or "Book ChapterStart-ChapterEnd"
- "day_label": "Day N" is fine; use thematic labels when natural
- "description": optional one-sentence theme summary for the day
- References must come from the 66 canonical Bible books""")
    return "\n\n".join(parts)


@router.post("")
async def generate_reading_plan(
    body: ReadingPlanRequest,
    _: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Stream an AI-generated reading plan from a natural-language goal."""
    client = _ai_client()

    async def generate():
        try:
            yield f"data: {json.dumps({'stage': 'generating', 'message': 'Designing your reading plan...'})}\n\n"

            accumulated = ""
            async with client.messages.stream(
                model=MODEL,
                max_tokens=8000,
                system=_system_blocks(),
                messages=[{"role": "user", "content": _user_prompt(body)}],
            ) as stream:
                async for text in stream.text_stream:
                    accumulated += text

            cleaned = accumulated.strip().strip("`").strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned)
            cleaned = cleaned.strip()

            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start == -1 or end == -1:
                raise ValueError(f"No JSON object found. Response: {cleaned[:200]}")
            cleaned = cleaned[start:end + 1]

            data = json.loads(cleaned)

            if "days" not in data or not isinstance(data["days"], list):
                raise ValueError("Missing 'days' array in response")

            yield f"data: {json.dumps({'stage': 'plan', 'plan': data})}\n\n"
            yield f"data: {json.dumps({'stage': 'done'})}\n\n"
            yield "data: [DONE]\n\n"

        except json.JSONDecodeError as e:
            yield f"data: {json.dumps({'error': f'Failed to parse plan: {str(e)}. Try rephrasing your goal.'})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
