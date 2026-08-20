from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..bible_data import resolve_book_name
from ..database import get_db
from ..models import CommentaryEntry

MAX_COMMENTARY_ENTRIES = 500

router = APIRouter(prefix="/api/commentary", tags=["commentary"])

COMMENTARY_DISPLAY_NAMES = {
    "MHC": "Matthew Henry's Commentary",
    "MHCC": "Matthew Henry's Concise Commentary",
    "JFB": "Jamieson, Fausset & Brown",
    "Barnes": "Barnes' Notes",
    "Clarke": "Adam Clarke's Commentary",
    "Calvin": "Calvin's Commentaries",
    "Wesley": "Wesley's Notes",
    "TSK": "Treasury of Scripture Knowledge",
    "KD": "Keil & Delitzsch",
    "RWP": "Robertson's Word Pictures",
    "Geneva": "Geneva Bible Notes",
    "Lightfoot": "Lightfoot's Commentary",
    "Luther": "Luther's Commentary",
    "TFG": "The Fourfold Gospel",
    "PNT": "People's New Testament",
    "TDavid": "Treasury of David (Spurgeon)",
    "Burkitt": "Burkitt's Commentary",
}


@router.get("/sources")
async def get_sources(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CommentaryEntry.source).distinct().order_by(CommentaryEntry.source)
    )
    sources = [row[0] for row in result.all()]
    return {
        "sources": [
            {"id": s, "name": COMMENTARY_DISPLAY_NAMES.get(s, s)}
            for s in sources
        ]
    }


@router.get("/{book}/{chapter}/{verse}")
async def get_verse_commentary(
    book: str,
    chapter: int,
    verse: int,
    sources: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    canonical = resolve_book_name(book)
    if not canonical:
        raise HTTPException(status_code=404, detail=f"Book not found: {book}")

    query = (
        select(CommentaryEntry)
        .where(
            CommentaryEntry.book == canonical,
            CommentaryEntry.chapter == chapter,
        )
        .filter(
            (
                (CommentaryEntry.verse_end.is_(None))
                & (CommentaryEntry.verse_start == verse)
            )
            | (
                (CommentaryEntry.verse_end.is_not(None))
                & (CommentaryEntry.verse_start <= verse)
                & (CommentaryEntry.verse_end >= verse)
            )
        )
        .order_by(CommentaryEntry.source, CommentaryEntry.verse_start)
        .limit(MAX_COMMENTARY_ENTRIES)
    )

    if sources:
        src_list = [s.strip() for s in sources.split(",")]
        query = query.where(CommentaryEntry.source.in_(src_list))

    result = await db.execute(query)
    entries = result.scalars().all()

    seen = set()
    deduped = []
    for e in entries:
        key = (e.source, e.verse_start, e.verse_end)
        if key not in seen:
            seen.add(key)
            deduped.append(e)

    return {
        "reference": f"{canonical} {chapter}:{verse}",
        "entries": [
            {
                "id": e.id,
                "source": e.source,
                "display_name": COMMENTARY_DISPLAY_NAMES.get(e.source, e.source),
                "verse_start": e.verse_start,
                "verse_end": e.verse_end,
                "text": e.text,
            }
            for e in deduped
        ],
    }


@router.get("/{book}/{chapter}")
async def get_chapter_commentary(
    book: str,
    chapter: int,
    source: str = Query(default="MHC"),
    db: AsyncSession = Depends(get_db),
):
    canonical = resolve_book_name(book)
    if not canonical:
        raise HTTPException(status_code=404, detail=f"Book not found: {book}")

    result = await db.execute(
        select(CommentaryEntry).where(
            CommentaryEntry.book == canonical,
            CommentaryEntry.chapter == chapter,
            CommentaryEntry.source == source,
        ).order_by(CommentaryEntry.verse_start).limit(MAX_COMMENTARY_ENTRIES)
    )
    entries = result.scalars().all()

    return {
        "reference": f"{canonical} {chapter}",
        "source": source,
        "display_name": COMMENTARY_DISPLAY_NAMES.get(source, source),
        "entries": [
            {
                "verse_start": e.verse_start,
                "verse_end": e.verse_end,
                "text": e.text,
            }
            for e in entries
        ],
    }
