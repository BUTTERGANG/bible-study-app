from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
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


@router.get("/strongs/{strongs_num}/range")
async def get_semantic_range(
    strongs_num: str,
    testament: str = Query(default="all", description="all, OT, NT"),
    db: AsyncSession = Depends(get_db),
):
    """Return gloss frequency distribution for a Strong's number.

    Aggregates english_gloss from greek_words (NT) or hebrew_words (OT/all) to
    produce a semantic range chart — how many times each English translation
    appears in the corpus.
    """
    is_greek = strongs_num.upper().startswith("G") or (
        not strongs_num.upper().startswith("H") and not strongs_num.isdigit()
    )

    NT_BOOKS = {
        "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
        "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
        "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
        "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
        "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
        "Jude", "Revelation",
    }

    if is_greek or testament == "NT":
        model = GreekWord
        word_col = GreekWord.greek
    else:
        model = HebrewWord
        word_col = HebrewWord.hebrew

    stmt = (
        select(model.english_gloss, func.count().label("count"))
        .where(model.strongs_num == strongs_num)
        .where(model.english_gloss.isnot(None))
        .where(model.english_gloss != "")
        .group_by(model.english_gloss)
        .order_by(func.count().desc())
    )

    if testament == "NT":
        stmt = stmt.where(model.book.in_(NT_BOOKS))
    elif testament == "OT":
        stmt = stmt.where(model.book.notin_(NT_BOOKS))

    result = await db.execute(stmt)
    rows = result.all()

    total = sum(r.count for r in rows)

    # Fetch up to 3 example verses per gloss in a single query using ROW_NUMBER().
    top_glosses = [r.english_gloss for r in rows[:10]]
    examples: dict[str, list] = {g: [] for g in top_glosses}
    if top_glosses:
        from sqlalchemy.dialects.sqlite import insert  # noqa: F401 (ensure dialect available)
        rn_col = func.row_number().over(
            partition_by=model.english_gloss,
            order_by=model.id,
        ).label("rn")
        subq = (
            select(model.book, model.chapter, model.verse, word_col.label("word"),
                   model.english_gloss, rn_col)
            .where(model.strongs_num == strongs_num)
            .where(model.english_gloss.in_(top_glosses))
            .subquery()
        )
        ex_result = await db.execute(
            select(subq).where(subq.c.rn <= 3)
        )
        for r in ex_result.all():
            gloss = r.english_gloss
            if gloss in examples:
                examples[gloss].append({"reference": f"{r.book} {r.chapter}:{r.verse}", "word": r.word})

    return {
        "strongs_num": strongs_num,
        "language": "greek" if is_greek else "hebrew",
        "total": total,
        "glosses": [
            {
                "gloss": r.english_gloss,
                "count": r.count,
                "percent": round(r.count / total * 100, 1) if total else 0,
                "examples": examples.get(r.english_gloss, []),
            }
            for r in rows
        ],
    }
