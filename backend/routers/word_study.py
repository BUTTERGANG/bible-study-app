from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import GreekWord, HebrewWord, LexiconEntry
from bible_data import resolve_book_name, BOOK_NUM_MAP

router = APIRouter(prefix="/api/word-study", tags=["word-study"])
lexicon_router = APIRouter(prefix="/api/lexicon", tags=["lexicon"])


@router.get("/{book}/{chapter}/{verse}")
async def get_verse_words(
    book: str,
    chapter: int,
    verse: int,
    db: AsyncSession = Depends(get_db),
):
    canonical = resolve_book_name(book)
    if not canonical:
        raise HTTPException(status_code=404, detail=f"Book not found: {book}")

    # Determine OT or NT
    from bible_data import BOOK_NAME_MAP
    book_data = BOOK_NAME_MAP.get(canonical.lower())
    testament = book_data["testament"] if book_data else "NT"

    if testament == "NT":
        result = await db.execute(
            select(GreekWord).where(
                GreekWord.book == canonical,
                GreekWord.chapter == chapter,
                GreekWord.verse == verse,
            ).order_by(GreekWord.word_position)
        )
        words = result.scalars().all()
        return {
            "reference": f"{canonical} {chapter}:{verse}",
            "language": "Greek",
            "words": [
                {
                    "position": w.word_position,
                    "original": w.greek,
                    "transliteration": w.transliteration,
                    "morphology": w.morphology,
                    "strongs": w.strongs_num,
                    "gloss": w.english_gloss,
                }
                for w in words
            ],
        }
    else:
        result = await db.execute(
            select(HebrewWord).where(
                HebrewWord.book == canonical,
                HebrewWord.chapter == chapter,
                HebrewWord.verse == verse,
            ).order_by(HebrewWord.word_position)
        )
        words = result.scalars().all()
        return {
            "reference": f"{canonical} {chapter}:{verse}",
            "language": "Hebrew",
            "words": [
                {
                    "position": w.word_position,
                    "original": w.hebrew,
                    "transliteration": w.transliteration,
                    "morphology": w.morphology,
                    "strongs": w.strongs_num,
                    "gloss": w.english_gloss,
                }
                for w in words
            ],
        }


@lexicon_router.get("/strongs/{strongs_num}")
async def get_strongs_entry(strongs_num: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LexiconEntry).where(LexiconEntry.strongs_num == strongs_num)
        .order_by(LexiconEntry.source)
    )
    entries = result.scalars().all()
    if not entries:
        raise HTTPException(status_code=404, detail=f"Strong's {strongs_num} not found")

    return {
        "strongs_num": strongs_num,
        "entries": [
            {
                "source": e.source,
                "original_word": e.original_word,
                "transliteration": e.transliteration,
                "pronunciation": e.pronunciation,
                "definition": e.definition,
                "usage": e.usage,
            }
            for e in entries
        ],
    }


@lexicon_router.get("/occurrences/{strongs_num}")
async def get_strongs_occurrences(
    strongs_num: str,
    language: str = Query(default="auto"),
    db: AsyncSession = Depends(get_db),
):
    is_greek = strongs_num.upper().startswith("G") or (
        not strongs_num.upper().startswith("H") and not strongs_num.isdigit()
    )

    if language == "greek" or (language == "auto" and is_greek):
        result = await db.execute(
            select(GreekWord).where(GreekWord.strongs_num == strongs_num)
            .order_by(GreekWord.book, GreekWord.chapter, GreekWord.verse)
            .limit(100)
        )
        words = result.scalars().all()
        return {
            "strongs_num": strongs_num,
            "count": len(words),
            "occurrences": [
                {
                    "reference": f"{w.book} {w.chapter}:{w.verse}",
                    "book": w.book,
                    "chapter": w.chapter,
                    "verse": w.verse,
                    "word": w.greek,
                    "gloss": w.english_gloss,
                }
                for w in words
            ],
        }
    else:
        result = await db.execute(
            select(HebrewWord).where(HebrewWord.strongs_num == strongs_num)
            .order_by(HebrewWord.book, HebrewWord.chapter, HebrewWord.verse)
            .limit(100)
        )
        words = result.scalars().all()
        return {
            "strongs_num": strongs_num,
            "count": len(words),
            "occurrences": [
                {
                    "reference": f"{w.book} {w.chapter}:{w.verse}",
                    "book": w.book,
                    "chapter": w.chapter,
                    "verse": w.verse,
                    "word": w.hebrew,
                    "gloss": w.english_gloss,
                }
                for w in words
            ],
        }
