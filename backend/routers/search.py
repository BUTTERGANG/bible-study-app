import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db

router = APIRouter(prefix="/api/search", tags=["search"])

# Set by lifespan via set_fts_availability(). Avoids the previous pattern of
# catching every exception from an FTS query as "table not built."
_FTS = {"bible": False, "commentary": False}


def set_fts_availability(*, bible: bool, commentary: bool) -> None:
    _FTS["bible"] = bible
    _FTS["commentary"] = commentary


def _sanitize_fts(query: str) -> str:
    """Quote each token so FTS5 doesn't interpret colons, hyphens, parens, etc.
    as syntax. Tokens are split on whitespace; double quotes inside tokens are
    escaped by doubling. Result is a space-joined sequence of phrase queries
    which FTS5 treats as an implicit AND."""
    tokens = [t for t in re.split(r"\s+", query.strip()) if t]
    if not tokens:
        return '""'
    return " ".join('"' + t.replace('"', '""') + '"' for t in tokens)


def _snippet(text_in: str, query: str, max_len: int = 200) -> str:
    """Find the earliest occurrence of any query token and center the snippet
    around it. Previously only used the first token, which often gave a
    snippet far from the actual match for multi-word queries."""
    lower = text_in.lower()
    tokens = [t.lower() for t in re.split(r"\s+", query.strip()) if t]
    pos = -1
    for tok in tokens:
        p = lower.find(tok)
        if p != -1 and (pos == -1 or p < pos):
            pos = p
    if pos == -1:
        return text_in[:max_len]
    start = max(0, pos - 50)
    end = min(len(text_in), pos + 150)
    snippet = text_in[start:end]
    if start > 0:
        snippet = "…" + snippet
    if end < len(text_in):
        snippet = snippet + "…"
    return snippet


@router.get("")
async def search(
    q: str = Query(..., min_length=2),
    scope: str = Query(default="bible"),
    translation: str = Query(default="KJV"),
    limit: int = Query(default=25, le=100),
    db: AsyncSession = Depends(get_db),
):
    results: list = []
    fts_query = _sanitize_fts(q)

    if scope in ("bible", "all"):
        if _FTS["bible"]:
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
                {"query": fts_query, "trans": translation.upper(), "lim": limit},
            )
        else:
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

    if scope in ("commentary", "all") and _FTS["commentary"]:
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
            {"query": fts_query, "lim": max(1, limit // 2)},
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

    return {"query": q, "count": len(results), "results": results}
