"""Reading streaks & badges — track daily reading plan completion.

Endpoints:
  GET  /api/streaks          — get current user's streak data + badges
  POST /api/streaks/record   — record a completion for today
  GET  /api/streaks/share    — generate a shareable streak card
"""

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import ReadingStreak, StreakBadge

router = APIRouter(prefix="/api/streaks", tags=["streaks"])

_MILESTONES = [7, 30, 100, 365]


class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_completed_date: str | None
    badges: list[dict]
    today_completed: bool


class StreakShareOut(BaseModel):
    current_streak: int
    longest_streak: int
    badges: list[int]
    share_text: str


@router.get("", response_model=StreakOut)
async def get_streak(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today().isoformat()
    streak = await _get_or_create_streak(db, user.id)
    await _check_streak_liveness(db, streak, today)

    result = await db.execute(
        select(StreakBadge).where(StreakBadge.user_id == user.id).order_by(StreakBadge.milestone)
    )
    badges = [
        {"milestone": b.milestone, "earned_at": b.earned_at.isoformat() if b.earned_at else None}
        for b in result.scalars().all()
    ]

    return StreakOut(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        last_completed_date=streak.last_completed_date,
        badges=badges,
        today_completed=streak.last_completed_date == today,
    )


@router.post("/record")
async def record_completion(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today().isoformat()
    streak = await _get_or_create_streak(db, user.id)

    if streak.last_completed_date == today:
        return {"current_streak": streak.current_streak, "already_recorded": True}

    yesterday = date.today().replace(day=date.today().day - 1).isoformat() if date.today().day > 1 else None

    if streak.last_completed_date == yesterday or streak.current_streak == 0:
        streak.current_streak += 1
    else:
        streak.current_streak = 1

    streak.last_completed_date = today

    if streak.current_streak > streak.longest_streak:
        streak.longest_streak = streak.current_streak

    await db.commit()

    new_badges = []
    for milestone in _MILESTONES:
        if streak.current_streak >= milestone:
            existing = await db.execute(
                select(StreakBadge).where(
                    StreakBadge.user_id == user.id,
                    StreakBadge.milestone == milestone,
                )
            )
            if not existing.scalar_one_or_none():
                badge = StreakBadge(user_id=user.id, milestone=milestone)
                db.add(badge)
                new_badges.append(milestone)

    await db.commit()

    return {
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "already_recorded": False,
        "new_badges": new_badges,
    }


@router.get("/share", response_model=StreakShareOut)
async def share_streak(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    streak = await _get_or_create_streak(db, user.id)

    result = await db.execute(
        select(StreakBadge).where(StreakBadge.user_id == user.id)
    )
    badge_milestones = [b.milestone for b in result.scalars().all()]

    badge_emoji = {7: "🔥", 30: "⭐", 100: "💎", 365: "👑"}
    badges_str = " ".join(badge_emoji.get(m, "🏅") for m in badge_milestones)
    share_text = (
        f"I'm on a {streak.current_streak}-day Bible reading streak! "
        f"{badges_str} Join me on LOGOS Bible Study."
    )

    return StreakShareOut(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        badges=badge_milestones,
        share_text=share_text,
    )


async def _get_or_create_streak(db: AsyncSession, user_id: int) -> ReadingStreak:
    result = await db.execute(
        select(ReadingStreak).where(ReadingStreak.user_id == user_id)
    )
    streak = result.scalar_one_or_none()
    if not streak:
        streak = ReadingStreak(user_id=user_id, current_streak=0, longest_streak=0)
        db.add(streak)
        await db.commit()
        await db.refresh(streak)
    return streak


async def _check_streak_liveness(db: AsyncSession, streak: ReadingStreak, today_iso: str) -> None:
    if not streak.last_completed_date:
        return
    if streak.last_completed_date == today_iso:
        return
    last = date.fromisoformat(streak.last_completed_date)
    today = date.fromisoformat(today_iso)
    days_since = (today - last).days
    if days_since > 1:
        streak.current_streak = 0
        await db.commit()
