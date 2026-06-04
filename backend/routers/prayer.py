"""Prayer Journal — personal prayer requests with verse linking and status tracking."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import PrayerEntry

router = APIRouter(prefix="/api/prayer", tags=["prayer"])


class PrayerCreate(BaseModel):
    title: str
    content: str
    book: str | None = None
    chapter: int | None = None
    verse: int | None = None
    category: str | None = None


class PrayerUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    status: str | None = None
    answered_note: str | None = None
    category: str | None = None


class PrayerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    book: str | None
    chapter: int | None
    verse: int | None
    status: str
    category: str | None
    answered_note: str | None
    created_at: datetime
    updated_at: datetime


class PrayerListOut(BaseModel):
    prayers: list[PrayerOut]
    limit: int
    offset: int


@router.get("", response_model=PrayerListOut)
async def list_prayers(
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    query = select(PrayerEntry).where(PrayerEntry.user_id == user.id)
    if status:
        query = query.where(PrayerEntry.status == status)
    query = query.order_by(PrayerEntry.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return PrayerListOut(
        prayers=result.scalars().all(),
        limit=limit,
        offset=offset,
    )


@router.post("", status_code=201, response_model=PrayerOut)
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
    return p


@router.patch("/{prayer_id}", response_model=PrayerOut)
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
    p.updated_at = datetime.now(UTC)
    await db.commit()
    return p


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
