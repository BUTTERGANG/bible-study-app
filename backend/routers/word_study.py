from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..bible_data import BOOK_NAME_MAP, resolve_book_name
from ..database import get_db
from ..models import GreekWord, HebrewWord

router = APIRouter(prefix="/api/word-study", tags=["word-study"])


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
