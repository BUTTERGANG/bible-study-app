"""Community tags — freeform labels on passages and resources.

Endpoints:
  POST /api/tags                     — add a tag to a passage or resource
  GET  /api/tags                     — list tags for a passage/resource (with tag cloud)
  GET  /api/tags/search              — browse/find content by tag text
  POST /api/tags/{tag_id}/upvote     — upvote a community tag
  DELETE /api/tags/{tag_id}          — remove own tag
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import PassageTag, TagUpvote

router = APIRouter(prefix="/api/tags", tags=["tags"])


class TagCreate(BaseModel):
    book: str | None = None
    chapter: int | None = None
    verse: int | None = None
    resource_id: int | None = None
    tag_text: str


class TagOut(BaseModel):
    id: int
    user_id: int
    book: str | None
    chapter: int | None
    verse: int | None
    resource_id: int | None
    tag_text: str
    upvotes: int
    is_own: bool
    has_upvoted: bool
    created_at: datetime | None


@router.post("", response_model=TagOut)
async def create_tag(
    body: TagCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.tag_text.strip():
        raise HTTPException(status_code=400, detail="Tag text cannot be empty")
    if len(body.tag_text) > 100:
        raise HTTPException(status_code=400, detail="Tag text too long (max 100 chars)")
    if body.book is None and body.resource_id is None:
        raise HTTPException(status_code=400, detail="Must specify either a passage or resource_id")

    tag = PassageTag(
        user_id=user.id,
        book=body.book,
        chapter=body.chapter,
        verse=body.verse,
        resource_id=body.resource_id,
        tag_text=body.tag_text.strip(),
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)

    return TagOut(
        id=tag.id, user_id=tag.user_id, book=tag.book, chapter=tag.chapter,
        verse=tag.verse, resource_id=tag.resource_id, tag_text=tag.tag_text,
        upvotes=tag.upvotes, is_own=True, has_upvoted=False, created_at=tag.created_at,
    )


@router.get("")
async def list_tags(
    book: Optional[str] = None,
    chapter: Optional[int] = None,
    verse: Optional[int] = None,
    resource_id: Optional[int] = None,
    limit: int = 50,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(PassageTag)
    if book: q = q.where(PassageTag.book == book)
    if chapter is not None: q = q.where(PassageTag.chapter == chapter)
    if verse is not None: q = q.where(PassageTag.verse == verse)
    if resource_id is not None: q = q.where(PassageTag.resource_id == resource_id)

    q = q.order_by(PassageTag.upvotes.desc(), PassageTag.created_at.desc()).limit(limit)
    result = await db.execute(q)
    tags = result.scalars().all()

    tag_ids = [t.id for t in tags]
    upvoted_ids = set()
    if tag_ids:
        uv_result = await db.execute(
            select(TagUpvote.tag_id).where(TagUpvote.user_id == user.id, TagUpvote.tag_id.in_(tag_ids))
        )
        upvoted_ids = {row[0] for row in uv_result.all()}

    cloud_q = (
        select(PassageTag.tag_text, func.count(), func.sum(PassageTag.upvotes))
        .group_by(PassageTag.tag_text).order_by(func.count().desc()).limit(10)
    )
    if book: cloud_q = cloud_q.where(PassageTag.book == book)
    if chapter is not None: cloud_q = cloud_q.where(PassageTag.chapter == chapter)

    cloud_result = await db.execute(cloud_q)
    tag_cloud = [
        {"tag_text": row[0], "count": row[1], "total_upvotes": row[2] or 0}
        for row in cloud_result.all()
    ]

    return {
        "tags": [
            {"id": t.id, "user_id": t.user_id, "book": t.book, "chapter": t.chapter,
             "verse": t.verse, "resource_id": t.resource_id, "tag_text": t.tag_text,
             "upvotes": t.upvotes, "is_own": t.user_id == user.id,
             "has_upvoted": t.id in upvoted_ids,
             "created_at": t.created_at.isoformat() if t.created_at else None}
            for t in tags
        ],
        "tag_cloud": tag_cloud,
    }


@router.get("/search")
async def search_by_tag(
    q: str,
    limit: int = 20,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PassageTag).where(PassageTag.tag_text.ilike(f"%{q}%"))
        .order_by(PassageTag.upvotes.desc()).limit(limit)
    )
    tags = result.scalars().all()

    passages, seen_refs = [], set()
    for t in tags:
        if t.book and t.chapter:
            ref = f"{t.book} {t.chapter}" + (f":{t.verse}" if t.verse else "")
            if ref not in seen_refs:
                seen_refs.add(ref)
                passages.append({"book": t.book, "chapter": t.chapter, "verse": t.verse, "reference": ref, "tag_count": 1})

    return {"query": q, "results": passages, "total": len(passages)}


@router.post("/{tag_id}/upvote")
async def upvote_tag(
    tag_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PassageTag).where(PassageTag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    existing = await db.execute(
        select(TagUpvote).where(TagUpvote.user_id == user.id, TagUpvote.tag_id == tag_id)
    )
    if existing.scalar_one_or_none():
        return {"upvotes": tag.upvotes, "already_upvoted": True}

    upvote = TagUpvote(user_id=user.id, tag_id=tag_id)
    db.add(upvote)
    tag.upvotes += 1
    await db.commit()
    return {"upvotes": tag.upvotes, "already_upvoted": False}


@router.delete("/{tag_id}")
async def delete_tag(
    tag_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PassageTag).where(PassageTag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.user_id != user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own tags")

    await db.execute(delete(TagUpvote).where(TagUpvote.tag_id == tag_id))
    await db.execute(delete(PassageTag).where(PassageTag.id == tag_id))
    await db.commit()
    return {"deleted": True}
