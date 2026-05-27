"""Gospel Harmony — synoptic parallel view of pericopes across Matthew, Mark, Luke, John.

GET /api/harmony              — list all sections and pericopes
GET /api/harmony/{pericope_id} — fetch aligned verses for a specific pericope
"""
import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import BibleVerse

logger = logging.getLogger("bible-study.harmony")
router = APIRouter(prefix="/api/harmony", tags=["harmony"])

# ── Load harmony data from static JSON ──────────────────────────────────────
_HARMONY_PATH = Path(__file__).parent.parent / "data" / "gospel_harmony.json"
_HARMONY_DATA = None


def _load_harmony():
    global _HARMONY_DATA
    if _HARMONY_DATA is not None:
        return _HARMONY_DATA
    try:
        with open(_HARMONY_PATH, encoding="utf-8") as f:
            _HARMONY_DATA = json.load(f)
    except FileNotFoundError:
        logger.error("gospel_harmony.json not found at %s", _HARMONY_PATH)
        _HARMONY_DATA = {"sections": []}
    return _HARMONY_DATA


def _parse_ref(ref_str):
    """Parse 'Book ch:vv-vv' -> (book, chapter, verse_start, verse_end)."""
    if not ref_str:
        return None
    parts = ref_str.rsplit(" ", 1)
    if len(parts) != 2:
        return None
    book = parts[0]
    ch_vv = parts[1]
    ch_parts = ch_vv.split(":")
    if len(ch_parts) != 2:
        return None
    chapter = int(ch_parts[0])
    vv = ch_vv.split(":")[1]
    if "-" in vv:
        v_start, v_end = vv.split("-", 1)
        return book, chapter, int(v_start), int(v_end)
    return book, chapter, int(vv), int(vv)


@router.get("")
async def list_harmony():
    """Return all sections and pericopes (metadata only, no verse text)."""
    data = _load_harmony()
    return data


@router.get("/{pericope_id}")
async def get_harmony_pericope(pericope_id: str, translation: str = "KJV", db: AsyncSession = Depends(get_db)):
    """Return aligned verses for a pericope across all four Gospels.

    Query param:
        translation — Bible translation to use (default: KJV)
    """
    data = _load_harmony()

    # Find the pericope
    pericope = None
    section_label = None
    for section in data["sections"]:
        for p in section["pericopes"]:
            if p["id"] == pericope_id:
                pericope = p
                section_label = section["label"]
                break
        if pericope:
            break

    if not pericope:
        raise HTTPException(status_code=404, detail=f"Pericope not found: {pericope_id}")

    # Resolve translation
    result = await db.execute(
        select(BibleVerse.translation)
        .where(BibleVerse.translation == translation)
        .limit(1)
    )
    resolved = result.scalar_one_or_none()
    if not resolved:
        raise HTTPException(status_code=404, detail=f"Translation not found: {translation}")

    # Fetch verses for each gospel
    gospels = ["matt", "mark", "luke", "john"]
    gospel_names = {"matt": "Matthew", "mark": "Mark", "luke": "Luke", "john": "John"}
    columns = []

    for gospel_key in gospels:
        ref_str = pericope.get(gospel_key)
        if not ref_str:
            columns.append({
                "gospel": gospel_key,
                "gospel_name": gospel_names[gospel_key],
                "reference": None,
                "verses": [],
                "present": False,
            })
            continue

        parsed = _parse_ref(ref_str)
        if not parsed:
            columns.append({
                "gospel": gospel_key,
                "gospel_name": gospel_names[gospel_key],
                "reference": ref_str,
                "verses": [],
                "present": False,
            })
            continue

        book, chapter, v_start, v_end = parsed
        result = await db.execute(
            select(BibleVerse)
            .where(
                BibleVerse.translation == resolved,
                BibleVerse.book == book,
                BibleVerse.chapter == chapter,
                BibleVerse.verse >= v_start,
                BibleVerse.verse <= v_end,
            )
            .order_by(BibleVerse.verse)
        )
        verses = result.scalars().all()
        columns.append({
            "gospel": gospel_key,
            "gospel_name": gospel_names[gospel_key],
            "reference": f"{book} {chapter}:{v_start}" + (f"-{v_end}" if v_end != v_start else ""),
            "verses": [{"verse": v.verse, "text": v.text} for v in verses],
            "present": True,
        })

    return {
        "pericope_id": pericope_id,
        "title": pericope["title"],
        "section": section_label,
        "translation": resolved,
        "columns": columns,
    }
