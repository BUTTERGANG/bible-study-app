from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import DictionaryEntry

router = APIRouter(prefix="/api/dictionary", tags=["dictionary"])


@router.get("/search")
async def search_dictionary(
    q: str = Query(..., min_length=2),
    source: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    # Escape SQL LIKE wildcards in user input to prevent unintended matches
    escaped = q.replace("%", "\\%").replace("_", "\\_")
    query = (
        select(DictionaryEntry)
        .where(DictionaryEntry.term.ilike(f"%{escaped}%"))
        .order_by(DictionaryEntry.term)
        .limit(20)
    )
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


@router.get("/{source}/{term}")
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
