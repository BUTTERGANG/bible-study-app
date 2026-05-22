from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..bible_data import resolve_book_name
from ..database import get_db
from ..models import Note

router = APIRouter(prefix="/api/notes", tags=["notes"])


class NoteCreate(BaseModel):
    book: str
    chapter: int
    verse: Optional[int] = None
    content: str
    tags: Optional[str] = None


class NoteUpdate(BaseModel):
    content: Optional[str] = None
    tags: Optional[str] = None


def _note_dict(n: Note) -> dict:
    return {
        "id": n.id,
        "book": n.book,
        "chapter": n.chapter,
        "verse": n.verse,
        "reference": (
            f"{n.book} {n.chapter}:{n.verse}" if n.verse else f"{n.book} {n.chapter}"
        ),
        "content": n.content,
        "tags": n.tags,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


@router.post("")
async def create_note(body: NoteCreate, db: AsyncSession = Depends(get_db)):
    canonical = resolve_book_name(body.book)
    if not canonical:
        raise HTTPException(status_code=400, detail=f"Unknown book: {body.book}")
    note = Note(
        book=canonical,
        chapter=body.chapter,
        verse=body.verse,
        content=body.content,
        tags=body.tags,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return _note_dict(note)


@router.get("")
async def list_notes(
    book: Optional[str] = None,
    chapter: Optional[int] = None,
    verse: Optional[int] = None,
    tag: Optional[str] = None,
    offset: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    query = select(Note)
    if book is not None:
        canonical = resolve_book_name(book)
        if not canonical:
            raise HTTPException(status_code=400, detail=f"Unknown book: {book}")
        query = query.where(Note.book == canonical)
    if chapter is not None:
        query = query.where(Note.chapter == chapter)
    if verse is not None:
        query = query.where(Note.verse == verse)
    if tag is not None:
        query = query.where(Note.tags.ilike(f"%{tag}%"))
    query = query.order_by(Note.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return {"notes": [_note_dict(n) for n in result.scalars().all()], "offset": offset, "limit": limit}


@router.put("/{note_id}")
async def update_note(note_id: int, body: NoteUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if body.content is not None:
        note.content = body.content
    if body.tags is not None:
        note.tags = body.tags
    note.updated_at = datetime.utcnow()
    await db.commit()
    return _note_dict(note)


@router.delete("/{note_id}")
async def delete_note(note_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(Note).where(Note.id == note_id))
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}
