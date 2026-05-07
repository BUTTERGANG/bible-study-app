from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import BibleVerse
from bible_data import BOOKS, resolve_book_name

router = APIRouter(prefix="/api/bible", tags=["bible"])


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

    result = await db.execute(
        select(BibleVerse)
        .where(
            BibleVerse.translation == translation.upper(),
            BibleVerse.book == canonical,
            BibleVerse.chapter == chapter,
        )
        .order_by(BibleVerse.verse)
    )
    verses = result.scalars().all()
    if not verses:
        raise HTTPException(status_code=404, detail="No verses found")

    return {
        "translation": translation.upper(),
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

    result = await db.execute(
        select(BibleVerse).where(
            BibleVerse.translation == translation.upper(),
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


@router.get("/compare/{book}/{chapter}/{verse}")
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

    trans_list = [t.strip().upper() for t in translations.split(",")]
    result = await db.execute(
        select(BibleVerse).where(
            BibleVerse.translation.in_(trans_list),
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
