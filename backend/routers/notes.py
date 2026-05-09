from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import Note, Highlight, Bookmark
from bible_data import resolve_book_name

router = APIRouter(prefix="/api/notes", tags=["notes"])
highlights_router = APIRouter(prefix="/api/highlights", tags=["highlights"])
bookmarks_router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


# --- Notes ---

class NoteCreate(BaseModel):
    reference: str
    book: str
    chapter: int
    verse: Optional[int] = None
    content: str
    tags: Optional[str] = None


class NoteUpdate(BaseModel):
    content: Optional[str] = None
    tags: Optional[str] = None


@router.post("")
async def create_note(body: NoteCreate, db: AsyncSession = Depends(get_db)):
    note = Note(
        reference=body.reference,
        book=body.book,
        chapter=body.chapter,
        verse=body.verse,
        content=body.content,
        tags=body.tags,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return _note_dict(note)


@router.get("/{reference:path}")
async def get_notes(reference: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Note).where(Note.reference == reference).order_by(Note.created_at)
    )
    return {"notes": [_note_dict(n) for n in result.scalars().all()]}


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
    await db.execute(delete(Note).where(Note.id == note_id))
    await db.commit()
    return {"ok": True}


def _note_dict(n: Note) -> dict:
    return {
        "id": n.id,
        "reference": n.reference,
        "book": n.book,
        "chapter": n.chapter,
        "verse": n.verse,
        "content": n.content,
        "tags": n.tags,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


# --- Highlights ---

class HighlightCreate(BaseModel):
    translation: str
    book: str
    chapter: int
    verse: int
    color: str = "yellow"


@highlights_router.post("")
async def create_highlight(body: HighlightCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(Highlight).where(
            Highlight.book == body.book,
            Highlight.chapter == body.chapter,
            Highlight.verse == body.verse,
            Highlight.translation == body.translation,
        )
    )
    hl = existing.scalar_one_or_none()
    if hl:
        hl.color = body.color
    else:
        hl = Highlight(
            translation=body.translation,
            book=body.book,
            chapter=body.chapter,
            verse=body.verse,
            color=body.color,
        )
        db.add(hl)
    await db.commit()
    return {"id": hl.id, "color": hl.color}


@highlights_router.get("/{book}/{chapter}")
async def get_chapter_highlights(
    book: str,
    chapter: int,
    translation: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    canonical = resolve_book_name(book)
    query = select(Highlight).where(
        Highlight.book == canonical,
        Highlight.chapter == chapter,
    )
    if translation:
        query = query.where(Highlight.translation == translation.upper())
    result = await db.execute(query)
    highlights = result.scalars().all()
    return {
        "highlights": {
            str(h.verse): {"color": h.color, "id": h.id}
            for h in highlights
        }
    }


@highlights_router.delete("/{highlight_id}")
async def delete_highlight(highlight_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Highlight).where(Highlight.id == highlight_id))
    await db.commit()
    return {"ok": True}


# --- Bookmarks ---

class BookmarkCreate(BaseModel):
    reference: str
    book: str
    chapter: int
    verse: Optional[int] = None
    note: Optional[str] = None


@bookmarks_router.post("")
async def create_bookmark(body: BookmarkCreate, db: AsyncSession = Depends(get_db)):
    bm = Bookmark(
        reference=body.reference,
        book=body.book,
        chapter=body.chapter,
        verse=body.verse,
        note=body.note,
    )
    db.add(bm)
    await db.commit()
    await db.refresh(bm)
    return {"id": bm.id, "reference": bm.reference}


@bookmarks_router.get("")
async def get_bookmarks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bookmark).order_by(Bookmark.created_at.desc()))
    bms = result.scalars().all()
    return {
        "bookmarks": [
            {
                "id": b.id,
                "reference": b.reference,
                "book": b.book,
                "chapter": b.chapter,
                "verse": b.verse,
                "note": b.note,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in bms
        ]
    }


@bookmarks_router.delete("/{bookmark_id}")
async def delete_bookmark(bookmark_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Bookmark).where(Bookmark.id == bookmark_id))
    await db.commit()
    return {"ok": True}
