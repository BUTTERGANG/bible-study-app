from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import GreekWord, HebrewWord, LexiconEntry

router = APIRouter(prefix="/api/lexicon", tags=["lexicon"])


@router.get("/strongs/{strongs_num}")
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


@router.get("/occurrences/{strongs_num}")
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
