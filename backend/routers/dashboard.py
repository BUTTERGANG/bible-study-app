"""Dashboard — verse of the day, active plan progress, AI reflection."""

import logging
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import BibleVerse, DailyDevotion, ReadingPlan, ReadingPlanDay, ReadingPlanProgress

logger = logging.getLogger("bible-study.dashboard")

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Memorable "verse of the day" pool — well-known encouraging verses by KJV id.
# These are rotated deterministically by day so the verse changes daily but is
# reproducible for any given date.
_VOTD_POOL = [
    "John 3:16", "Psalm 23:1", "Proverbs 3:5", "Romans 8:28",
    "Philippians 4:13", "Isaiah 40:31", "Jeremiah 29:11", "Matthew 11:28",
    "Psalm 46:1", "Romans 8:38", "Hebrews 11:1", "James 1:5",
    "1 Corinthians 13:4", "Ephesians 2:8", "Lamentations 3:22",
    "Joshua 1:9", "Psalm 119:105", "Matthew 6:33", "Romans 12:2",
    "Galatians 5:22", "Colossians 3:23", "2 Timothy 1:7", "Psalm 27:1",
    "Isaiah 41:10", "Luke 1:37", "John 14:6", "Romans 5:8",
    "Philippians 4:6", "Psalm 37:4", "1 Peter 5:7",
]

_BOOK_MAP = {
    "Genesis": "Genesis", "Psalms": "Psalms", "Psalm": "Psalms",
    "Proverbs": "Proverbs", "Isaiah": "Isaiah", "Jeremiah": "Jeremiah",
    "Lamentations": "Lamentations", "Joshua": "Joshua", "Matthew": "Matthew",
    "Luke": "Luke", "John": "John", "Romans": "Romans",
    "1 Corinthians": "1 Corinthians", "Galatians": "Galatians",
    "Ephesians": "Ephesians", "Philippians": "Philippians",
    "Colossians": "Colossians", "2 Timothy": "2 Timothy",
    "Hebrews": "Hebrews", "James": "James", "1 Peter": "1 Peter",
}


def _parse_ref(ref: str):
    """Parse 'Book chapter:verse' -> (book, chapter, verse)."""
    parts = ref.rsplit(" ", 1)
    book = parts[0]
    cv = parts[1].split(":")
    return book, int(cv[0]), int(cv[1])


async def _get_votd(db: AsyncSession) -> Optional[dict]:
    today = date.today()
    day_index = today.toordinal() % len(_VOTD_POOL)
    ref = _VOTD_POOL[day_index]
    book, chapter, verse = _parse_ref(ref)

    result = await db.execute(
        select(BibleVerse).where(
            BibleVerse.translation == "KJV",
            BibleVerse.book == book,
            BibleVerse.chapter == chapter,
            BibleVerse.verse == verse,
        )
    )
    v = result.scalar_one_or_none()
    if not v:
        return None
    return {
        "reference": ref,
        "book": v.book,
        "chapter": v.chapter,
        "verse": v.verse,
        "text": v.text,
        "translation": "KJV",
    }


async def _get_active_plan(db: AsyncSession, user_id: int) -> Optional[dict]:
    today = str(date.today())

    plan_result = await db.execute(
        select(ReadingPlan)
        .where(ReadingPlan.user_id == user_id)
        .order_by(ReadingPlan.created_at.desc())
        .limit(1)
    )
    plan = plan_result.scalar_one_or_none()
    if not plan:
        return None

    # Today's readings
    today_result = await db.execute(
        select(ReadingPlanDay)
        .where(ReadingPlanDay.plan_id == plan.id, ReadingPlanDay.date == today)
    )
    today_readings = today_result.scalars().all()

    # Completed today
    completed_result = await db.execute(
        select(func.count()).where(
            ReadingPlanProgress.plan_id == plan.id,
            ReadingPlanProgress.date == today,
            ReadingPlanProgress.completed_at.isnot(None),
        )
    )
    completed_count = completed_result.scalar() or 0

    # Overall progress: distinct days with any completion vs total days in plan
    total_days_result = await db.execute(
        select(func.count(ReadingPlanDay.id.distinct())).where(ReadingPlanDay.plan_id == plan.id)
    )
    total_days = total_days_result.scalar() or 1

    completed_days_result = await db.execute(
        select(func.count(ReadingPlanProgress.date.distinct())).where(
            ReadingPlanProgress.plan_id == plan.id,
            ReadingPlanProgress.completed_at.isnot(None),
        )
    )
    completed_days = completed_days_result.scalar() or 0

    return {
        "plan_id": plan.id,
        "plan_name": plan.name,
        "today_readings": [r.reference for r in today_readings],
        "today_completed": completed_count,
        "today_total": len(today_readings),
        "overall_progress": round(completed_days / total_days * 100) if total_days else 0,
    }


async def _get_cached_reflection(db: AsyncSession, verse_ref: str) -> Optional[str]:
    today = str(date.today())
    result = await db.execute(
        select(DailyDevotion).where(
            DailyDevotion.verse_ref == verse_ref,
            DailyDevotion.date == today,
        )
    )
    d = result.scalar_one_or_none()
    return d.reflection if d else None


async def _cache_reflection(db: AsyncSession, verse_ref: str, reflection: str):
    today = str(date.today())
    devotion = DailyDevotion(verse_ref=verse_ref, date=today, reflection=reflection)
    db.add(devotion)
    try:
        await db.commit()
    except Exception:
        await db.rollback()


@router.get("")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    votd, plan = await _get_votd(db), await _get_active_plan(db, user.id)

    reflection = None
    if votd:
        reflection = await _get_cached_reflection(db, votd["reference"])

    return {
        "verse_of_day": votd,
        "active_plan": plan,
        "reflection": reflection,
    }


@router.post("/reflection")
async def generate_reflection(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Stream a short devotional reflection for today's verse of the day, caching the result."""
    import os
    import anthropic

    votd = await _get_votd(db)
    if not votd:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Verse of day not found")

    cached = await _get_cached_reflection(db, votd["reference"])
    if cached:
        async def _yield_cached():
            yield cached
        return StreamingResponse(_yield_cached(), media_type="text/plain")

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

    prompt = (
        f"Write a brief 2-sentence devotional reflection on {votd['reference']}: "
        f'"{votd["text"]}" — Make it personal, encouraging, and grounded in the text. '
        "Do not use headers. Write as flowing prose."
    )

    collected = []

    async def _stream():
        with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for chunk in stream.text_stream:
                collected.append(chunk)
                yield chunk

        reflection = "".join(collected)
        await _cache_reflection(db, votd["reference"], reflection)

    return StreamingResponse(_stream(), media_type="text/plain")
