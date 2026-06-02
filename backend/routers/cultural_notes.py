"""Cultural context notes — AI-generated historical/cultural background per verse.

Endpoints:
  GET /api/cultural/{book}/{chapter}          — get notes for all verses in a chapter
  GET /api/cultural/{book}/{chapter}/{verse}   — get note for a specific verse

Notes are AI-generated on first request and cached in the DB.
"""

import json
import logging
import os
from typing import Optional

import anthropic

logger = logging.getLogger("bible-study.cultural-notes")
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import BibleVerse, CulturalNote
from ..rate_limit import ai_rate_limit

router = APIRouter(
    prefix="/api/cultural",
    tags=["cultural-notes"],
)

MODEL = "claude-sonnet-4-6"
_C_CACHE = {"type": "ephemeral"}

_async_client: Optional[anthropic.AsyncAnthropic] = None
_cached_key: Optional[str] = None


def _client() -> anthropic.AsyncAnthropic:
    global _async_client, _cached_key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI features require ANTHROPIC_API_KEY. In Replit: Tools → Secrets → Add ANTHROPIC_API_KEY.",
        )
    if _async_client is None or api_key != _cached_key:
        _async_client = anthropic.AsyncAnthropic(api_key=api_key)
        _cached_key = api_key
    return _async_client


CULTURAL_SYSTEM_PROMPT = """You are an expert biblical historian and cultural commentator, drawing on the scholarship of:
- Craig S. Keener (IVP Bible Background Commentary)
- The Zondervan Illustrated Bible Backgrounds Commentary
- The Jewish Study Bible (Oxford)
- The Anchor Yale Bible Dictionary
- Ancient sources: Josephus, Philo, Mishnah, Talmud, Dead Sea Scrolls, Septuagint, Targums, Midrashim

Your task: provide concise, accurate cultural and historical background for specific Bible verses.
Focus on what the original audience would have understood. Be specific — mention actual ancient sources
(Josephus Antiquities, Mishnah tractate names, specific Roman customs, etc.) rather than generic statements."""


class NoteResponse(BaseModel):
    book: str
    chapter: int
    verse: int
    content: str
    cached: bool = False


def _build_cultural_prompt(book: str, chapter: int, verse_num: int, verse_text: str, chapter_context: str) -> str:
    return f"""Provide 1-3 short cultural/historical background notes for this verse.

Reference: {book} {chapter}:{verse_num}
Verse text: "{verse_text}"

Chapter context (first 1500 chars): {chapter_context[:1500]}

For each note:
- Start with a specific detail about 1st-century Jewish/Roman culture, historical practice, or ancient source
- Mention the actual ancient source where relevant (e.g. "Josephus notes in Antiquities...", "Mishnah tractate Pesahim describes...")
- Be concrete: explain what the original readers would have understood that modern readers miss
- Keep each note to 1-2 sentences

Return ONLY a JSON array of note objects, no markdown:
[
  {{"topic": "Custom/Law/Practice/History", "note": "The cultural note text with source citation."}},
  ...
]

Include 1-3 notes. If the verse has no significant cultural background, return an empty array []."""


@router.get("/{book}/{chapter}", response_model=list[NoteResponse])
async def get_chapter_cultural_notes(
    book: str,
    chapter: int,
    db: AsyncSession = Depends(get_db),
    _rl: None = Depends(ai_rate_limit),
):
    """Get cultural context notes for all verses in a chapter.
    Returns cached notes where available; generates missing ones on-demand."""
    # First, return all cached notes
    cached_result = await db.execute(
        select(CulturalNote).where(
            CulturalNote.book == book,
            CulturalNote.chapter == chapter,
        ).order_by(CulturalNote.verse)
    )
    cached_notes = cached_result.scalars().all()
    cached_map = {(n.book, n.chapter, n.verse): n for n in cached_notes}

    # Fetch the chapter text so we can generate missing notes
    chapter_result = await db.execute(
        select(BibleVerse).where(
            BibleVerse.book == book,
            BibleVerse.chapter == chapter,
            BibleVerse.translation == "KJV",
        ).order_by(BibleVerse.verse)
    )
    verses = chapter_result.scalars().all()
    if not verses:
        return []

    chapter_context = " ".join(v.text for v in verses)

    # Generate notes for verses that don't have cached entries (limit to first 5 uncached to avoid over-generation)
    uncached_verses = [v for v in verses if (v.book, v.chapter, v.verse) not in cached_map][:5]
    newly_generated = []

    for v in uncached_verses:
        prompt = _build_cultural_prompt(book, chapter, v.verse, v.text, chapter_context)
        try:
            client = _client()
            message = await client.messages.create(
                model=MODEL,
                max_tokens=512,
                system=[{"type": "text", "text": CULTURAL_SYSTEM_PROMPT, "cache_control": _C_CACHE}],
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text.strip()
            try:
                notes_list = json.loads(raw)
            except json.JSONDecodeError:
                start = raw.find("[")
                end = raw.rfind("]") + 1
                notes_list = json.loads(raw[start:end]) if start != -1 else []

            if isinstance(notes_list, list):
                combined = "\n\n".join(
                    f"**{n.get('topic', 'Context')}:** {n.get('note', '')}"
                    for n in notes_list if isinstance(n, dict) and n.get('note')
                )
            else:
                combined = ""

            if combined:
                cultural_note = CulturalNote(
                    book=book, chapter=chapter, verse=v.verse, content=combined,
                )
                db.add(cultural_note)
                newly_generated.append((v.verse, cultural_note))
        except Exception as exc:
            logger.warning("Cultural note generation failed for %s %d:%d — %s", book, chapter, v.verse, exc)

    if newly_generated:
        await db.commit()
        for _, note in newly_generated:
            await db.refresh(note)

    # Build response: combine cached + newly generated
    all_notes = list(cached_notes) + [n for _, n in newly_generated]

    return [
        NoteResponse(
            book=n.book,
            chapter=n.chapter,
            verse=n.verse,
            content=n.content,
            cached=(n.book, n.chapter, n.verse) in cached_map,
        )
        for n in sorted(all_notes, key=lambda x: x.verse)
    ]


@router.get("/{book}/{chapter}/{verse}", response_model=NoteResponse)
async def get_verse_cultural_note(
    book: str,
    chapter: int,
    verse: int,
    db: AsyncSession = Depends(get_db),
    _rl: None = Depends(ai_rate_limit),
):
    """Generate or return cached cultural context note for a specific verse."""
    # Check cache
    result = await db.execute(
        select(CulturalNote).where(
            CulturalNote.book == book,
            CulturalNote.chapter == chapter,
            CulturalNote.verse == verse,
        )
    )
    cached = result.scalar_one_or_none()
    if cached:
        return NoteResponse(book=book, chapter=chapter, verse=verse, content=cached.content, cached=True)

    # Fetch verse text
    verse_result = await db.execute(
        select(BibleVerse).where(
            BibleVerse.book == book,
            BibleVerse.chapter == chapter,
            BibleVerse.verse == verse,
            BibleVerse.translation == "KJV",
        )
    )
    verse_row = verse_result.scalar_one_or_none()
    if not verse_row:
        raise HTTPException(status_code=404, detail=f"Verse {book} {chapter}:{verse} not found")

    # Get chapter context
    chapter_result = await db.execute(
        select(BibleVerse).where(
            BibleVerse.book == book,
            BibleVerse.chapter == chapter,
            BibleVerse.translation == "KJV",
        ).order_by(BibleVerse.verse)
    )
    chapter_text = " ".join(r.text for r in chapter_result.scalars().all())[:1500]

    prompt = _build_cultural_prompt(book, chapter, verse, verse_row.text, chapter_text)
    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=[{"type": "text", "text": CULTURAL_SYSTEM_PROMPT, "cache_control": _C_CACHE}],
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    try:
        notes_list = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        notes_list = json.loads(raw[start:end]) if start != -1 else []

    if isinstance(notes_list, list):
        combined = "\n\n".join(
            f"**{n.get('topic', 'Context')}:** {n.get('note', '')}"
            for n in notes_list if isinstance(n, dict) and n.get('note')
        )
    else:
        combined = ""

    if combined:
        note = CulturalNote(book=book, chapter=chapter, verse=verse, content=combined)
        db.add(note)
        await db.commit()
        await db.refresh(note)

    return NoteResponse(book=book, chapter=chapter, verse=verse, content=combined, cached=False)
