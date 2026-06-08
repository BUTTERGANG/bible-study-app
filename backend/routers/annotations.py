"""Inline word/phrase annotations anchored to verse token positions."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import InlineAnnotation

router = APIRouter(prefix="/api/annotations", tags=["annotations"])


class AnnotationCreate(BaseModel):
    book: str
    chapter: int
    verse: int
    word_start: int
    word_end: int
    content: str
    color: str = "yellow"


class AnnotationUpdate(BaseModel):
    content: Optional[str] = None
    color: Optional[str] = None


def _annotation_dict(a: InlineAnnotation) -> dict:
    return {
        "id": a.id,
        "user_id": a.user_id,
        "book": a.book,
        "chapter": a.chapter,
        "verse": a.verse,
        "word_start": a.word_start,
        "word_end": a.word_end,
        "content": a.content,
        "color": a.color,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.get("")
async def list_annotations(
    book: str,
    chapter: int,
    verse: Optional[int] = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(InlineAnnotation).where(
        InlineAnnotation.user_id == user.id,
        InlineAnnotation.book == book,
        InlineAnnotation.chapter == chapter,
    )
    if verse is not None:
        q = q.where(InlineAnnotation.verse == verse)
    q = q.order_by(InlineAnnotation.verse, InlineAnnotation.word_start)
    result = await db.execute(q)
    return {"annotations": [_annotation_dict(a) for a in result.scalars().all()]}


@router.post("")
async def create_annotation(
    body: AnnotationCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.word_end < body.word_start:
        raise HTTPException(status_code=400, detail="word_end must be >= word_start")
    annotation = InlineAnnotation(
        user_id=user.id,
        book=body.book,
        chapter=body.chapter,
        verse=body.verse,
        word_start=body.word_start,
        word_end=body.word_end,
        content=body.content,
        color=body.color,
    )
    db.add(annotation)
    await db.commit()
    await db.refresh(annotation)
    return _annotation_dict(annotation)


@router.put("/{annotation_id}")
async def update_annotation(
    annotation_id: int,
    body: AnnotationUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InlineAnnotation).where(
            InlineAnnotation.id == annotation_id,
            InlineAnnotation.user_id == user.id,
        )
    )
    annotation = result.scalar_one_or_none()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if body.content is not None:
        annotation.content = body.content
    if body.color is not None:
        annotation.color = body.color
    annotation.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return _annotation_dict(annotation)


@router.delete("/{annotation_id}")
async def delete_annotation(
    annotation_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InlineAnnotation).where(
            InlineAnnotation.id == annotation_id,
            InlineAnnotation.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Annotation not found")
    await db.execute(
        delete(InlineAnnotation).where(
            InlineAnnotation.id == annotation_id,
            InlineAnnotation.user_id == user.id,
        )
    )
    await db.commit()
    return {"deleted": True}
