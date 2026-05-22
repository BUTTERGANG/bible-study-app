"""Prayer Journal — personal prayer requests with verse linking and status tracking."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import PrayerEntry

router = APIRouter(prefix="/api/prayer", tags=["prayer"])


class PrayerCreate(BaseModel):
    title: str
    content: str
    book: Optional[str] = None
    chapter: Optional[int] = None
    verse: Optional[int] = None
    category: Optional[str] = None


class PrayerUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    answered_note: Optional[str] = None
    category: Optional[str] = None


def _out(p: PrayerEntry) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "content": p.content,
        "book": p.book,
        "chapter": p.chapter,
        "verse": p.verse,
        "status": p.status,
        "category": p.category,
        "answered_note": p.answered_note,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }


@router.get("")
async def list_prayers(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    query = select(PrayerEntry).where(PrayerEntry.user_id == user.id)
    if status:
        query = query.where(PrayerEntry.status == status)
    query = query.order_by(PrayerEntry.created_at.desc())
    result = await db.execute(query)
    return {"prayers": [_out(p) for p in result.scalars().all()]}


@router.post("", status_code=201)
async def create_prayer(
    body: PrayerCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    p = PrayerEntry(
        user_id=user.id,
        title=body.title,
        content=body.content,
        book=body.book,
        chapter=body.chapter,
        verse=body.verse,
        category=body.category,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _out(p)


@router.patch("/{prayer_id}")
async def update_prayer(
    prayer_id: int,
    body: PrayerUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(PrayerEntry).where(PrayerEntry.id == prayer_id, PrayerEntry.user_id == user.id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Prayer not found")

    if body.title is not None:
        p.title = body.title
    if body.content is not None:
        p.content = body.content
    if body.status is not None:
        p.status = body.status
    if body.answered_note is not None:
        p.answered_note = body.answered_note
    if body.category is not None:
        p.category = body.category
    p.updated_at = datetime.utcnow()
    await db.commit()
    return _out(p)


@router.delete("/{prayer_id}", status_code=204)
async def delete_prayer(
    prayer_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(PrayerEntry).where(PrayerEntry.id == prayer_id, PrayerEntry.user_id == user.id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Prayer not found")
    await db.delete(p)
    await db.commit()
