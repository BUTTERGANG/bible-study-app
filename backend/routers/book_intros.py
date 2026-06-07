"""Book Introduction — AI-generated, cached per book."""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import BookIntroduction
from ..ai_client import get_client as _client

logger = logging.getLogger("bible-study.book-intros")

router = APIRouter(prefix="/api/bible/books", tags=["book-intros"])


def _intro_out(intro: BookIntroduction) -> dict:
    try:
        content = json.loads(intro.content_json)
    except Exception:
        content = {}
    return {
        "book": intro.book_name,
        "generated_at": intro.generated_at.isoformat(),
        **content,
    }


@router.get("/{book_name}/introduction")
async def get_book_introduction(
    book_name: str,
    refresh: bool = False,
    db: AsyncSession = Depends(get_db),
):
    if not refresh:
        result = await db.execute(
            select(BookIntroduction).where(BookIntroduction.book_name == book_name)
        )
        cached = result.scalar_one_or_none()
        if cached:
            return _intro_out(cached)

    prompt = (
        f"Write a concise introduction to the Bible book of {book_name}. "
        "Return ONLY valid JSON with these exact keys:\n"
        '  "author": "Traditional or attributed author(s)",\n'
        '  "date": "Approximate date written or events covered",\n'
        '  "context": "2-3 sentence historical/cultural context",\n'
        '  "themes": ["theme1", "theme2", "theme3", "theme4", "theme5"],\n'
        '  "structure": "2-3 sentence outline of the book\'s main sections"\n'
        "Be concise. Themes list: 3-5 items max."
    )

    message = await _client().messages.create(
        model="claude-haiku-4-5",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = {"author": "Unknown", "date": "Unknown", "context": raw, "themes": [], "structure": ""}

    content_json = json.dumps(parsed)

    # Upsert into DB
    result = await db.execute(
        select(BookIntroduction).where(BookIntroduction.book_name == book_name)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.content_json = content_json
        existing.generated_at = datetime.now(timezone.utc)
    else:
        intro = BookIntroduction(book_name=book_name, content_json=content_json)
        db.add(intro)
    await db.commit()

    return {"book": book_name, **parsed}
