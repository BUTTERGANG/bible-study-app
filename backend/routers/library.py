import os

try:
    import fitz  # PyMuPDF
    _FITZ_OK = True
except (ImportError, OSError):
    fitz = None
    _FITZ_OK = False

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import LibraryBook, LibraryPage

router = APIRouter(prefix="/api/library", tags=["library"])


@router.get("/books")
async def list_books(
    category: str = Query(default=""),
    available_only: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    query = select(LibraryBook).order_by(LibraryBook.category, LibraryBook.title)
    if category:
        query = query.where(LibraryBook.category == category)
    result = await db.execute(query)
    books = result.scalars().all()

    items = []
    for b in books:
        # A book is available if its pages have been pre-extracted to the
        # library_pages table, or if PyMuPDF + the source file are both present.
        has_pages = bool(b.page_count) and b.page_count > 0
        on_disk = bool(b.source_path) and os.path.exists(b.source_path)
        available = has_pages and (on_disk or b.source_format != "pdf" or False)
        # Even without on-disk PDF, if pages are pre-extracted, we can serve.
        pre_extracted = await db.execute(
            select(LibraryPage.id).where(LibraryPage.book_id == b.id).limit(1)
        )
        if pre_extracted.scalar_one_or_none() is not None:
            available = True
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


@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LibraryBook.category).distinct().order_by(LibraryBook.category)
    )
    return {"categories": [row[0] for row in result.all()]}
