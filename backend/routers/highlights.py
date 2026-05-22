from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..bible_data import resolve_book_name
from ..database import get_db
from ..models import Highlight

router = APIRouter(prefix="/api/highlights", tags=["highlights"])


class HighlightCreate(BaseModel):
    translation: str
    book: str
    chapter: int
    verse: int
    color: str = "yellow"


@router.post("")
async def create_highlight(body: HighlightCreate, db: AsyncSession = Depends(get_db)):
    canonical = resolve_book_name(body.book)
    if not canonical:
        raise HTTPException(status_code=400, detail=f"Unknown book: {body.book}")

    # Atomic upsert — no read-then-write race. The (translation, book, chapter,
    # verse) uniqueness is enforced by models.Highlight via UniqueConstraint.
    stmt = (
        sqlite_insert(Highlight)
        .values(
            translation=body.translation,
            book=canonical,
            chapter=body.chapter,
            verse=body.verse,
            color=body.color,
        )
        .on_conflict_do_update(
            index_elements=["translation", "book", "chapter", "verse"],
            set_={"color": body.color},
        )
    )
    await db.execute(stmt)
    await db.commit()

    result = await db.execute(
        select(Highlight).where(
            Highlight.translation == body.translation,
            Highlight.book == canonical,
            Highlight.chapter == body.chapter,
            Highlight.verse == body.verse,
        )
    )
    hl = result.scalar_one()
    return {"id": hl.id, "color": hl.color}


@router.get("/{book}/{chapter}")
async def get_chapter_highlights(
    book: str,
    chapter: int,
    translation: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    canonical = resolve_book_name(book)
    if not canonical:
        raise HTTPException(status_code=404, detail=f"Book not found: {book}")
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


@router.delete("/{highlight_id}")
async def delete_highlight(highlight_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(Highlight).where(Highlight.id == highlight_id))
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Highlight not found")
    return {"ok": True}
