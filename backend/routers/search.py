from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import get_db

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def search(
    q: str = Query(..., min_length=2),
    scope: str = Query(default="bible"),
    translation: str = Query(default="KJV"),
    limit: int = Query(default=25, le=100),
    db: AsyncSession = Depends(get_db),
):
    results = []

    if scope in ("bible", "all"):
        # SQLite FTS5 search over bible_verses
        try:
            rows = await db.execute(
                text(
                    """
                    SELECT b.book, b.chapter, b.verse, b.text, b.translation
                    FROM bible_verses_fts fts
                    JOIN bible_verses b ON b.rowid = fts.rowid
                    WHERE fts.text MATCH :query
                      AND b.translation = :trans
                    ORDER BY rank
                    LIMIT :lim
                    """
                ),
                {"query": q, "trans": translation.upper(), "lim": limit},
            )
            for row in rows:
                results.append({
                    "type": "verse",
                    "reference": f"{row.book} {row.chapter}:{row.verse}",
                    "book": row.book,
                    "chapter": row.chapter,
                    "verse": row.verse,
                    "translation": row.translation,
                    "text": row.text,
                    "snippet": _snippet(row.text, q),
                })
        except Exception:
            # FTS table may not be built yet — fall back to LIKE
            rows = await db.execute(
                text(
                    """
                    SELECT book, chapter, verse, text, translation
                    FROM bible_verses
                    WHERE translation = :trans AND text LIKE :q
                    ORDER BY book_num, chapter, verse
                    LIMIT :lim
                    """
                ),
                {"trans": translation.upper(), "q": f"%{q}%", "lim": limit},
            )
            for row in rows:
                results.append({
                    "type": "verse",
                    "reference": f"{row.book} {row.chapter}:{row.verse}",
                    "book": row.book,
                    "chapter": row.chapter,
                    "verse": row.verse,
                    "translation": row.translation,
                    "text": row.text,
                    "snippet": _snippet(row.text, q),
                })

    if scope in ("commentary", "all"):
        try:
            rows = await db.execute(
                text(
                    """
                    SELECT c.source, c.book, c.chapter, c.verse_start, c.text
                    FROM commentary_fts fts
                    JOIN commentary_entries c ON c.rowid = fts.rowid
                    WHERE fts.text MATCH :query
                    ORDER BY rank
                    LIMIT :lim
                    """
                ),
                {"query": q, "lim": limit // 2},
            )
            for row in rows:
                results.append({
                    "type": "commentary",
                    "source": row.source,
                    "book": row.book,
                    "chapter": row.chapter,
                    "verse": row.verse_start,
                    "reference": f"{row.book} {row.chapter}:{row.verse_start}",
                    "snippet": _snippet(row.text, q),
                })
        except Exception:
            pass

    return {"query": q, "count": len(results), "results": results}


def _snippet(text: str, query: str, max_len: int = 200) -> str:
    lower = text.lower()
    pos = lower.find(query.lower().split()[0])
    if pos == -1:
        return text[:max_len]
    start = max(0, pos - 50)
    end = min(len(text), pos + 150)
    snippet = text[start:end]
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet
