from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..bible_data import resolve_book_name
from ..database import get_db
from ..models import Bookmark

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


class BookmarkCreate(BaseModel):
    book: str
    chapter: int
    verse: Optional[int] = None
    note: Optional[str] = None


def _bookmark_dict(b: Bookmark) -> dict:
    return {
        "id": b.id,
        "book": b.book,
        "chapter": b.chapter,
        "verse": b.verse,
        "reference": (
            f"{b.book} {b.chapter}:{b.verse}" if b.verse else f"{b.book} {b.chapter}"
        ),
        "note": b.note,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


@router.post("")
async def create_bookmark(body: BookmarkCreate, db: AsyncSession = Depends(get_db)):
    canonical = resolve_book_name(body.book)
    if not canonical:
        raise HTTPException(status_code=400, detail=f"Unknown book: {body.book}")
    bm = Bookmark(
        book=canonical,
        chapter=body.chapter,
        verse=body.verse,
        note=body.note,
    )
    db.add(bm)
    await db.commit()
    await db.refresh(bm)
    return _bookmark_dict(bm)


@router.get("")
async def list_bookmarks(
    offset: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bookmark).order_by(Bookmark.created_at.desc()).offset(offset).limit(limit)
    )
    return {"bookmarks": [_bookmark_dict(b) for b in result.scalars().all()], "offset": offset, "limit": limit}


@router.delete("/{bookmark_id}")
async def delete_bookmark(bookmark_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(Bookmark).where(Bookmark.id == bookmark_id))
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return {"ok": True}
