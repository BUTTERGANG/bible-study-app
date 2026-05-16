from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models import BibleVerse
from ..bible_data import BOOKS, resolve_book_name

router = APIRouter(prefix="/api/bible", tags=["bible"])


async def resolve_translation(translation: str, db: AsyncSession) -> str:
    """Return the canonical (DB-stored) translation name, case-insensitively."""
    result = await db.execute(
        select(BibleVerse.translation)
        .where(func.lower(BibleVerse.translation) == translation.lower())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row if row else translation


@router.get("/books")
async def get_books():
    return BOOKS


@router.get("/translations")
async def get_translations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BibleVerse.translation).distinct().order_by(BibleVerse.translation)
    )
    translations = [row[0] for row in result.all()]
    return {"translations": translations}


# Translation comparison. Renamed from /compare/... to /compare-translations/...
# so it can't be ambiguous with /{translation}/...
@router.get("/compare-translations/{book}/{chapter}/{verse}")
async def compare_translations(
    book: str,
    chapter: int,
    verse: int,
    translations: str = Query(default="KJV,ASV,YLT"),
    db: AsyncSession = Depends(get_db),
):
    canonical = resolve_book_name(book)
    if not canonical:
        raise HTTPException(status_code=404, detail=f"Book not found: {book}")

    trans_list = [t.strip() for t in translations.split(",")]
    resolved = [await resolve_translation(t, db) for t in trans_list]

    result = await db.execute(
        select(BibleVerse).where(
            BibleVerse.translation.in_(resolved),
            BibleVerse.book == canonical,
            BibleVerse.chapter == chapter,
            BibleVerse.verse == verse,
        ).order_by(BibleVerse.translation)
    )
    verses = result.scalars().all()
    return {
        "reference": f"{canonical} {chapter}:{verse}",
        "translations": {v.translation: v.text for v in verses},
    }


# Per-translation book list moved under /translations/{translation}/books so it
# can't collide with /{translation}/{book}/{chapter}.
@router.get("/translations/{translation}/books")
async def get_translation_books(translation: str, db: AsyncSession = Depends(get_db)):
    canonical_t = await resolve_translation(translation, db)
    result = await db.execute(
        select(
            BibleVerse.book,
            BibleVerse.book_num,
            func.max(BibleVerse.chapter).label("max_chapter"),
        )
        .where(BibleVerse.translation == canonical_t)
        .group_by(BibleVerse.book, BibleVerse.book_num)
        .order_by(BibleVerse.book_num, BibleVerse.book)
    )
    rows = result.all()
    if not rows:
        raise HTTPException(status_code=404, detail=f"Translation not found: {translation}")

    books = []
    for book_name, book_num, max_chapter in rows:
        if book_num == 0:
            testament = "APO"
        elif book_num <= 39:
            testament = "OT"
        else:
            testament = "NT"
        books.append({
            "name": book_name,
            "book_num": book_num,
            "chapters": max_chapter,
            "testament": testament,
        })

    return {"translation": canonical_t, "books": books}


@router.get("/{translation}/{book}/{chapter}")
async def get_chapter(
    translation: str,
    book: str,
    chapter: int,
    db: AsyncSession = Depends(get_db),
):
    canonical = resolve_book_name(book)
    if not canonical:
        raise HTTPException(status_code=404, detail=f"Book not found: {book}")

    canonical_t = await resolve_translation(translation, db)
    result = await db.execute(
        select(BibleVerse)
        .where(
            BibleVerse.translation == canonical_t,
            BibleVerse.book == canonical,
            BibleVerse.chapter == chapter,
        )
        .order_by(BibleVerse.verse)
    )
    verses = result.scalars().all()
    if not verses:
        raise HTTPException(status_code=404, detail="No verses found")

    return {
        "translation": canonical_t,
        "book": canonical,
        "chapter": chapter,
        "verses": [{"verse": v.verse, "text": v.text} for v in verses],
    }


@router.get("/{translation}/{book}/{chapter}/{verse}")
async def get_verse(
    translation: str,
    book: str,
    chapter: int,
    verse: int,
    db: AsyncSession = Depends(get_db),
):
    canonical = resolve_book_name(book)
    if not canonical:
        raise HTTPException(status_code=404, detail=f"Book not found: {book}")

    canonical_t = await resolve_translation(translation, db)
    result = await db.execute(
        select(BibleVerse).where(
            BibleVerse.translation == canonical_t,
            BibleVerse.book == canonical,
            BibleVerse.chapter == chapter,
            BibleVerse.verse == verse,
        )
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Verse not found")

    return {
        "translation": v.translation,
        "book": v.book,
        "chapter": v.chapter,
        "verse": v.verse,
        "text": v.text,
        "reference": f"{v.book} {v.chapter}:{v.verse}",
    }
