from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..bible_data import resolve_book_name
from ..database import get_db
from ..models import Note

router = APIRouter(prefix="/api/notes", tags=["notes"])


class NoteCreate(BaseModel):
    book: str
    chapter: int
    verse: int | None = None
    content: str
    tags: str | None = None


class NoteUpdate(BaseModel):
    content: str | None = None
    tags: str | None = None


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    book: str
    chapter: int
    verse: int | None
    # Computed reference string — populated by the endpoint before returning
    reference: str
    content: str
    tags: str | None
    created_at: datetime | None
    updated_at: datetime | None


class NoteListOut(BaseModel):
    notes: list[NoteOut]
    offset: int
    limit: int


def _note_out(n: Note) -> NoteOut:
    return NoteOut(
        id=n.id,
        book=n.book,
        chapter=n.chapter,
        verse=n.verse,
        reference=(
            f"{n.book} {n.chapter}:{n.verse}" if n.verse else f"{n.book} {n.chapter}"
        ),
        content=n.content,
        tags=n.tags,
        created_at=n.created_at,
        updated_at=n.updated_at,
    )


@router.post("", response_model=NoteOut)
async def create_note(
    body: NoteCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    # Resolve canonical Bible book name; fall back to raw value for general notes
    # (e.g. library summaries tagged with "Library" or a custom category).
    canonical = resolve_book_name(body.book) or body.book
    note = Note(
        user_id=user.id,
        book=canonical,
        chapter=body.chapter,
        verse=body.verse,
        content=body.content,
        tags=body.tags,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return _note_out(note)


@router.get("", response_model=NoteListOut)
async def list_notes(
    book: str | None = None,
    chapter: int | None = None,
    verse: int | None = None,
    tag: str | None = None,
    offset: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    query = select(Note).where(Note.user_id == user.id)
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
    return NoteListOut(
        notes=[_note_out(n) for n in result.scalars().all()],
        offset=offset,
        limit=limit,
    )


@router.put("/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: int,
    body: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(select(Note).where(Note.id == note_id, Note.user_id == user.id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if body.content is not None:
        note.content = body.content
    if body.tags is not None:
        note.tags = body.tags
    note.updated_at = datetime.now(UTC)
    await db.commit()
    return _note_out(note)


@router.delete("/{note_id}")
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(delete(Note).where(Note.id == note_id, Note.user_id == user.id))
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}
