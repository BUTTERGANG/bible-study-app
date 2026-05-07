import os
import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import LibraryBook, DictionaryEntry
from bible_data import resolve_book_name

router = APIRouter(prefix="/api/library", tags=["library"])
dictionary_router = APIRouter(prefix="/api/dictionary", tags=["dictionary"])


@router.get("/books")
async def list_books(
    category: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    query = select(LibraryBook).order_by(LibraryBook.category, LibraryBook.title)
    if category:
        query = query.where(LibraryBook.category == category)
    result = await db.execute(query)
    books = result.scalars().all()
    return {
        "books": [
            {
                "id": b.id,
                "title": b.title,
                "author": b.author,
                "category": b.category,
                "format": b.source_format,
                "pages": b.page_count,
            }
            for b in books
        ]
    }


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

    if book.source_format == "pdf":
        if not os.path.exists(book.source_path):
            raise HTTPException(
                status_code=404,
                detail=f"PDF file not available on this server: {book.title}",
            )
        try:
            pdf = fitz.open(book.source_path)
            if page_num < 1 or page_num > pdf.page_count:
                pdf.close()
                raise HTTPException(status_code=404, detail="Page not found")
            page = pdf[page_num - 1]
            text = page.get_text()
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
        if not os.path.exists(book.source_path):
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


# --- Dictionary ---

@dictionary_router.get("/search")
async def search_dictionary(
    q: str = Query(..., min_length=2),
    source: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    query = select(DictionaryEntry).where(
        DictionaryEntry.term.ilike(f"%{q}%")
    ).order_by(DictionaryEntry.term).limit(20)

    if source:
        query = query.where(DictionaryEntry.source == source)

    result = await db.execute(query)
    entries = result.scalars().all()
    return {
        "query": q,
        "results": [
            {"id": e.id, "source": e.source, "term": e.term, "snippet": e.text[:200]}
            for e in entries
        ],
    }


@dictionary_router.get("/{source}/{term}")
async def get_dictionary_entry(source: str, term: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DictionaryEntry).where(
            DictionaryEntry.source == source,
            DictionaryEntry.term.ilike(term),
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail=f"{term} not found in {source}")
    return {"source": entry.source, "term": entry.term, "text": entry.text}
