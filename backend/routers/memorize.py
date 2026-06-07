"""Verse Memorization — add verses to a memory queue and track quiz progress."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import MemoryVerse

router = APIRouter(prefix="/api/memorize", tags=["memorize"])


class AddVerseRequest(BaseModel):
    translation: str = "KJV"
    book: str
    chapter: int
    verse: int
    verse_text: str


class QuizResultRequest(BaseModel):
    correct: bool


def _verse_out(v: MemoryVerse) -> dict:
    return {
        "id": v.id,
        "translation": v.translation,
        "book": v.book,
        "chapter": v.chapter,
        "verse": v.verse,
        "verse_text": v.verse_text,
        "mastery_level": v.mastery_level,
        "attempts": v.attempts,
        "correct_count": v.correct_count,
        "last_reviewed": v.last_reviewed.isoformat() if v.last_reviewed else None,
        "added_at": v.added_at.isoformat(),
    }


@router.get("")
async def list_verses(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(MemoryVerse)
        .where(MemoryVerse.user_id == user.id)
        .order_by(MemoryVerse.mastery_level, MemoryVerse.added_at)
    )
    verses = result.scalars().all()
    return {"verses": [_verse_out(v) for v in verses]}


@router.post("", status_code=201)
async def add_verse(
    body: AddVerseRequest,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    existing = await db.execute(
        select(MemoryVerse).where(
            MemoryVerse.user_id == user.id,
            MemoryVerse.translation == body.translation,
            MemoryVerse.book == body.book,
            MemoryVerse.chapter == body.chapter,
            MemoryVerse.verse == body.verse,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Verse already in memory queue")

    mv = MemoryVerse(
        user_id=user.id,
        translation=body.translation,
        book=body.book,
        chapter=body.chapter,
        verse=body.verse,
        verse_text=body.verse_text,
    )
    db.add(mv)
    await db.commit()
    await db.refresh(mv)
    return _verse_out(mv)


@router.delete("/{verse_id}", status_code=204)
async def remove_verse(
    verse_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(MemoryVerse).where(MemoryVerse.id == verse_id, MemoryVerse.user_id == user.id)
    )
    mv = result.scalar_one_or_none()
    if not mv:
        raise HTTPException(status_code=404, detail="Memory verse not found")
    await db.delete(mv)
    await db.commit()


@router.post("/{verse_id}/quiz")
async def record_quiz_result(
    verse_id: int,
    body: QuizResultRequest,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(MemoryVerse).where(MemoryVerse.id == verse_id, MemoryVerse.user_id == user.id)
    )
    mv = result.scalar_one_or_none()
    if not mv:
        raise HTTPException(status_code=404, detail="Memory verse not found")

    mv.attempts += 1
    mv.last_reviewed = datetime.now(timezone.utc)
    if body.correct:
        mv.correct_count += 1

    # Update mastery level based on accuracy
    if mv.attempts >= 3:
        accuracy = mv.correct_count / mv.attempts
        if accuracy >= 0.9 and mv.attempts >= 5:
            mv.mastery_level = 3  # mastered
        elif accuracy >= 0.7:
            mv.mastery_level = 2  # familiar
        else:
            mv.mastery_level = 1  # learning

    await db.commit()
    return _verse_out(mv)
