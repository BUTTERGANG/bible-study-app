"""Textual notes — AI-generated textual criticism summaries for disputed passages.

GET  /api/textual-notes/{passage_key}  — get or generate a textual note
POST /api/textual-notes/generate       — force-regenerate a note

passage_key format: "BookName_Ch_Vs" e.g. "Mark_16_9"
Notes are cached in the DB and regenerated only on explicit request.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai_client import get_client as _client
from ..auth import require_app_password
from ..database import get_db
from ..models import TextualNote
from ..rate_limit import ai_rate_limit

logger = logging.getLogger("bible-study.textual-notes")

router = APIRouter(
    prefix="/api/textual-notes",
    tags=["textual-notes"],
    dependencies=[Depends(require_app_password), Depends(ai_rate_limit)],
)

MODEL = "claude-sonnet-4-6"


def _build_prompt(passage_key: str) -> str:
    passage_display = passage_key.replace("_", " ")
    return f"""You are a biblical textual criticism scholar. For the passage '{passage_display}', provide a brief scholarly summary of the textual issues.

Return ONLY valid JSON (no markdown, no preamble):
{{
  "passage": "<canonical passage name>",
  "summary": "<2–3 sentence overview of the textual issue>",
  "key_variants": [
    {{
      "variant_type": "<addition|omission|substitution|transposition>",
      "description": "<what the manuscripts disagree on>",
      "significance": "<critical|high|medium|low>",
      "scholarly_consensus": "<brief statement of current consensus>"
    }}
  ],
  "translation_impact": "<how variants affect major translations like KJV, NIV, ESV>",
  "recommended_resources": ["<Metzger Textual Commentary>", "<NA28>"]
}}"""


async def _generate_note(passage_key: str, db: AsyncSession) -> dict:
    client = _client()
    try:
        msg = await client.messages.create(
            model=MODEL,
            max_tokens=900,
            messages=[{"role": "user", "content": _build_prompt(passage_key)}],
        )
        text = msg.content[0].text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    except Exception as exc:
        logger.warning("AI textual note generation failed for %s: %s", passage_key, exc)
        raise HTTPException(status_code=503, detail="AI generation failed; try again later") from exc

    note = TextualNote(passage_key=passage_key, content=text)
    db.add(note)
    await db.commit()
    await db.refresh(note)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text}


@router.get("/{passage_key}")
async def get_textual_note(passage_key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TextualNote).where(TextualNote.passage_key == passage_key)
    )
    note = result.scalar_one_or_none()
    if note:
        try:
            content = json.loads(note.content)
        except json.JSONDecodeError:
            content = {"raw": note.content}
        return {
            "passage_key": note.passage_key,
            "content": content,
            "cached": True,
            "generated_at": note.generated_at.isoformat() if note.generated_at else None,
        }

    content = await _generate_note(passage_key, db)
    return {"passage_key": passage_key, "content": content, "cached": False, "generated_at": None}


class RegenerateRequest(BaseModel):
    passage_key: str


@router.post("/generate")
async def regenerate_textual_note(body: RegenerateRequest, db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(TextualNote).where(TextualNote.passage_key == body.passage_key)
    )
    await db.commit()
    content = await _generate_note(body.passage_key, db)
    return {"passage_key": body.passage_key, "content": content, "cached": False}
