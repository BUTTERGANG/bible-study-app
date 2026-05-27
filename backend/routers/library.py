import os
import re

try:
    import fitz  # PyMuPDF
    _FITZ_OK = True
except (ImportError, OSError):
    fitz = None
    _FITZ_OK = False

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import LibraryBook, LibraryPage

router = APIRouter(prefix="/api/library", tags=["library"])


@router.get("/books")
async def list_books(
    category: str = Query(default=""),
    available_only: bool = Query(default=False),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(LibraryBook).order_by(LibraryBook.category, LibraryBook.title)
    if category:
        query = query.where(LibraryBook.category == category)
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    books = result.scalars().all()

    # Batch check which books have pre-extracted pages (single query vs N)
    book_ids = [b.id for b in books]
    if book_ids:
        page_check = await db.execute(
            select(LibraryPage.book_id)
            .where(LibraryPage.book_id.in_(book_ids))
            .distinct()
        )
        has_pages = set(page_check.scalars().all())
    else:
        has_pages = set()

    items = []
    for b in books:
        if b.id in has_pages:
            available = True
        else:
            on_disk = bool(b.source_path) and os.path.exists(b.source_path)
            available = on_disk and (_FITZ_OK or b.source_format != "pdf")
        if available_only and not available:
            continue
        items.append({
            "id": b.id,
            "title": b.title,
            "author": b.author,
            "category": b.category,
            "format": b.source_format,
            "pages": b.page_count,
            "available": available,
        })
    return {"books": items}


@router.get("/books/{book_id}/page/{page_num}")
async def get_book_page(
    book_id: int,
    page_num: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LibraryBook).where(LibraryBook.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Preferred path: pre-extracted page from the DB. Survives without PyMuPDF
    # and without the original PDF on disk.
    page_row = await db.execute(
        select(LibraryPage).where(
            LibraryPage.book_id == book_id,
            LibraryPage.page_num == page_num,
        )
    )
    page = page_row.scalar_one_or_none()
    if page is not None:
        return {
            "book_id": book_id,
            "title": book.title,
            "page": page_num,
            "total_pages": book.page_count,
            "text": page.text,
        }

    # Fallback: read live from the PDF (development convenience).
    if book.source_format == "pdf":
        if not _FITZ_OK:
            raise HTTPException(
                status_code=503,
                detail="PDF reading not available — pages have not been pre-extracted, and PyMuPDF is unavailable in this environment.",
            )
        if not os.path.exists(book.source_path):
            raise HTTPException(
                status_code=404,
                detail=f"PDF file not available and no pre-extracted pages: {book.title}",
            )
        try:
            pdf = fitz.open(book.source_path)
            if page_num < 1 or page_num > pdf.page_count:
                pdf.close()
                raise HTTPException(status_code=404, detail="Page not found")
            text = pdf[page_num - 1].get_text()
            pdf.close()
            return {
                "book_id": book_id,
                "title": book.title,
                "page": page_num,
                "total_pages": book.page_count,
                "text": text,
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=400, detail=f"Cannot read format: {book.source_format}")


@router.get("/books/{book_id}/toc")
async def get_table_of_contents(book_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LibraryBook).where(LibraryBook.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if book.source_format == "pdf":
        if not _FITZ_OK or not os.path.exists(book.source_path):
            return {"title": book.title, "toc": [], "unavailable": True}
        try:
            pdf = fitz.open(book.source_path)
            toc = pdf.get_toc()
            pdf.close()
            return {
                "title": book.title,
                "toc": [{"level": t[0], "title": t[1], "page": t[2]} for t in toc],
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return {"title": book.title, "toc": []}


@router.get("/search")
async def search_library(
    q: str = Query(..., min_length=2),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Full-text search across all library pages using FTS5."""
    # Build a prefix-match expression so partial words match (e.g. 'burning bu'
    # finds 'burning bush'). Strip FTS5 special chars from each token.
    tokens = [re.sub(r'[^\w\']', '', t) for t in q.split() if t]
    tokens = [t for t in tokens if t]
    fts_q = " ".join(t + "*" for t in tokens) if tokens else '""'
    rows = await db.execute(
        text("""
            SELECT
                lp.book_id,
                lp.page_num,
                lb.title,
                lb.author,
                lb.category,
                snippet(library_pages_fts, 0, '<mark>', '</mark>', '…', 20) AS snippet
            FROM library_pages_fts
            JOIN library_pages lp ON lp.id = library_pages_fts.rowid
            JOIN library_books lb ON lb.id = lp.book_id
            WHERE library_pages_fts MATCH :q
            ORDER BY rank
            LIMIT :limit
        """),
        {"q": fts_q, "limit": limit},
    )
    results = []
    for row in rows:
        results.append({
            "book_id": row.book_id,
            "page_num": row.page_num,
            "title": row.title,
            "author": row.author,
            "category": row.category,
            "snippet": row.snippet,
        })
    return {"query": q, "results": results, "count": len(results)}


@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LibraryBook.category).distinct().order_by(LibraryBook.category)
    )
    return {"categories": [row[0] for row in result.all()]}
