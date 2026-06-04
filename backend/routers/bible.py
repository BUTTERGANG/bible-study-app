from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

_BIBLE_CACHE = "public, max-age=86400, stale-while-revalidate=604800"

from ..database import get_db
from ..models import BibleVerse, GreekWord, HebrewWord, LexiconEntry
from ..bible_data import BOOKS, resolve_book_name

router = APIRouter(prefix="/api/bible", tags=["bible"])

_TRANSLATION_CACHE: dict[str, str] = {}


async def resolve_translation(translation: str, db: AsyncSession) -> str:
    """Return the canonical (DB-stored) translation name, case-insensitively.
    Result is cached in-process — translation list never changes at runtime."""
    key = translation.lower()
    if key not in _TRANSLATION_CACHE:
        result = await db.execute(
            select(BibleVerse.translation)
            .where(func.lower(BibleVerse.translation) == key)
            .limit(1)
        )
        row = result.scalar_one_or_none()
        _TRANSLATION_CACHE[key] = row if row else translation
    return _TRANSLATION_CACHE[key]


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

    return JSONResponse(
        content={
            "translation": canonical_t,
            "book": canonical,
            "chapter": chapter,
            "verses": [{"verse": v.verse, "text": v.text} for v in verses],
        },
        headers={"Cache-Control": _BIBLE_CACHE},
    )


@router.get("/{translation}/{book}/{chapter}/interlinear")
async def get_chapter_interlinear(
    translation: str,
    book: str,
    chapter: int,
    db: AsyncSession = Depends(get_db),
):
    canonical = resolve_book_name(book)
    if not canonical:
        raise HTTPException(status_code=404, detail=f"Book not found: {book}")

    canonical_t = await resolve_translation(translation, db)

    # Determine testament from book number to pick the right word table
    book_num = None
    for b in BOOKS:
        if b["name"] == canonical:
            book_num = b["num"]
            break

    is_nt = book_num is not None and book_num >= 39

    # Single query: fetch words with verse number, grouped in Python
    if is_nt:
        result = await db.execute(
            select(GreekWord)
            .where(
                GreekWord.book == canonical,
                GreekWord.chapter == chapter,
            )
            .order_by(GreekWord.verse, GreekWord.word_position)
        )
        words = result.scalars().all()
        verses_map = {}
        for w in words:
            verses_map.setdefault(w.verse, []).append({
                "position": w.word_position,
                "original": w.greek,
                "transliteration": w.transliteration or "",
                "morphology": w.morphology or "",
                "strongs": w.strongs_num or "",
                "gloss": w.english_gloss or "",
            })
    else:
        result = await db.execute(
            select(HebrewWord)
            .where(
                HebrewWord.book == canonical,
                HebrewWord.chapter == chapter,
            )
            .order_by(HebrewWord.verse, HebrewWord.word_position)
        )
        words = result.scalars().all()
        verses_map = {}
        for w in words:
            verses_map.setdefault(w.verse, []).append({
                "position": w.word_position,
                "original": w.hebrew,
                "transliteration": w.transliteration or "",
                "morphology": w.morphology or "",
                "strongs": w.strongs_num or "",
                "gloss": w.english_gloss or "",
            })

    return {
        "translation": canonical_t,
        "book": canonical,
        "chapter": chapter,
        "language": "greek" if is_nt else "hebrew",
        "verses": [
            {"verse": v, "words": ws}
            for v, ws in sorted(verses_map.items())
        ],
    }


@router.get("/{translation}/{book}/{chapter}/lemmas")
async def get_chapter_lemmas(
    translation: str,
    book: str,
    chapter: int,
    db: AsyncSession = Depends(get_db),
):
    """Return per-verse lemma data for inline display in the passage reader.

    Lighter weight than full interlinear: includes lemma forms, Strong's numbers,
    and morphology per word position, plus lexicon definitions in a single
    joined query. Designed to be lazy-loaded per chapter.
    """
    canonical = resolve_book_name(book)
    if not canonical:
        raise HTTPException(status_code=404, detail=f"Book not found: {book}")

    # Determine testament from book name
    book_data = None
    for b in BOOKS:
        if b["name"] == canonical:
            book_data = b
            break
    is_nt = book_data is not None and book_data["testament"] == "NT"

    if is_nt:
        # Fetch Greek words with lexicon join for definitions
        result = await db.execute(
            select(GreekWord, LexiconEntry)
            .outerjoin(
                LexiconEntry,
                (GreekWord.strongs_num == LexiconEntry.strongs_num)
                & (LexiconEntry.source == "AbbottSmith"),
            )
            .where(
                GreekWord.book == canonical,
                GreekWord.chapter == chapter,
            )
            .order_by(GreekWord.verse, GreekWord.word_position)
        )
        rows = result.all()
        verses_map = {}
        for greek_word, lex in rows:
            verses_map.setdefault(greek_word.verse, []).append({
                "position": greek_word.word_position,
                "original": greek_word.greek,
                "transliteration": greek_word.transliteration or "",
                "morphology": greek_word.morphology or "",
                "strongs": greek_word.strongs_num or "",
                "gloss": greek_word.english_gloss or "",
                "definition": lex.definition if lex else None,
            })
    else:
        # Fetch Hebrew words with lexicon join for definitions
        result = await db.execute(
            select(HebrewWord, LexiconEntry)
            .outerjoin(
                LexiconEntry,
                (HebrewWord.strongs_num == LexiconEntry.strongs_num)
                & (LexiconEntry.source == "StrongsHebrew"),
            )
            .where(
                HebrewWord.book == canonical,
                HebrewWord.chapter == chapter,
            )
            .order_by(HebrewWord.verse, HebrewWord.word_position)
        )
        rows = result.all()
        verses_map = {}
        for hebrew_word, lex in rows:
            verses_map.setdefault(hebrew_word.verse, []).append({
                "position": hebrew_word.word_position,
                "original": hebrew_word.hebrew,
                "transliteration": hebrew_word.transliteration or "",
                "morphology": hebrew_word.morphology or "",
                "strongs": hebrew_word.strongs_num or "",
                "gloss": hebrew_word.english_gloss or "",
                "definition": lex.definition if lex else None,
            })

    return {
        "translation": translation,
        "book": canonical,
        "chapter": chapter,
        "language": "greek" if is_nt else "hebrew",
        "verses": [
            {"verse": v, "words": ws}
            for v, ws in sorted(verses_map.items())
        ],
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

    return JSONResponse(
        content={
            "translation": v.translation,
            "book": v.book,
            "chapter": v.chapter,
            "verse": v.verse,
            "text": v.text,
            "reference": f"{v.book} {v.chapter}:{v.verse}",
        },
        headers={"Cache-Control": _BIBLE_CACHE},
    )
