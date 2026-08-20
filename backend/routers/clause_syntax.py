"""Clause syntax search endpoints and fixture-backed ingest contract."""

import json
from pathlib import Path

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import BibleVerse, ClauseSyntax

router = APIRouter(prefix="/api/search", tags=["search"])

_DATA_FILE = Path(__file__).parent.parent / "data" / "clause_syntax_seed.json"
_PAULINE_BOOKS = {
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon",
}


class ClauseSyntaxSearchRequest(BaseModel):
    verb_mood: str = Field(default="", max_length=30)
    verb_tense: str = Field(default="", max_length=30)
    verb_voice: str = Field(default="", max_length=30)
    role: str = Field(default="", max_length=50)
    scope: str = Field(default="all", pattern="^(all|ot|nt|book|pauline|non-pauline)$")
    book: str = Field(default="", max_length=50)
    keyword: str = Field(default="", max_length=100)
    lemma: str = Field(default="", max_length=100)
    strongs_num: str = Field(default="", max_length=20)
    limit: int = Field(default=50, ge=1, le=200)


async def seed_clause_syntax(db: AsyncSession) -> int:
    """Seed curated clause annotations if the fixture rows are not already present."""
    if not _DATA_FILE.exists():
        return 0

    rows = json.loads(_DATA_FILE.read_text())
    inserted = 0
    for row in rows:
        source = row.get("source", "fixture")
        clause_id = row["clause_id"]
        existing = await db.execute(
            select(ClauseSyntax.id).where(
                ClauseSyntax.source == source,
                ClauseSyntax.clause_id == clause_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue
        db.add(ClauseSyntax(
            source=source,
            clause_id=clause_id,
            book=row["book"],
            book_num=row["book_num"],
            chapter=row["chapter"],
            verse_start=row["verse_start"],
            verse_end=row.get("verse_end") or row["verse_start"],
            clause_text=row["clause_text"],
            role=row["role"].lower(),
            verb_tense=(row.get("verb_tense") or "").lower() or None,
            verb_voice=(row.get("verb_voice") or "").lower() or None,
            verb_mood=(row.get("verb_mood") or "").lower() or None,
            verb_person=row.get("verb_person"),
            verb_number=row.get("verb_number"),
            verb_lemma=row.get("verb_lemma"),
            verb_strongs=row.get("verb_strongs"),
            tokens_json=json.dumps(row.get("tokens") or []),
            metadata_json=json.dumps(row.get("metadata") or {}),
        ))
        inserted += 1

    if inserted:
        await db.commit()
    return inserted


def _metadata(row: ClauseSyntax) -> dict:
    try:
        return json.loads(row.metadata_json or "{}")
    except json.JSONDecodeError:
        return {}


def _highlight(clause: str, verse_text: str) -> dict:
    start = verse_text.lower().find(clause.lower()) if verse_text else -1
    if start >= 0:
        return {"text": clause, "match_start": start, "match_end": start + len(clause)}
    return {"text": clause, "match_start": None, "match_end": None}


def _query_dict(req: ClauseSyntaxSearchRequest) -> dict:
    return req.model_dump(exclude_none=True)


@router.get("/clause-syntax/facets")
async def clause_syntax_facets(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(ClauseSyntax))).scalars().all()
    return {
        "roles": sorted({r.role for r in rows if r.role}),
        "tenses": sorted({r.verb_tense for r in rows if r.verb_tense}),
        "voices": sorted({r.verb_voice for r in rows if r.verb_voice}),
        "moods": sorted({r.verb_mood for r in rows if r.verb_mood}),
        "books": sorted({r.book for r in rows if r.book}),
        "scopes": ["all", "ot", "nt", "pauline", "non-pauline", "book"],
    }


@router.post("/clause-syntax")
async def clause_syntax_search(
    req: ClauseSyntaxSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if req.verb_mood:
        conditions.append(ClauseSyntax.verb_mood == req.verb_mood.lower())
    if req.verb_tense:
        conditions.append(ClauseSyntax.verb_tense == req.verb_tense.lower())
    if req.verb_voice:
        conditions.append(ClauseSyntax.verb_voice == req.verb_voice.lower())
    if req.role:
        conditions.append(ClauseSyntax.role == req.role.lower())
    if req.book:
        conditions.append(ClauseSyntax.book == req.book)

    if req.scope == "ot":
        conditions.append(ClauseSyntax.book_num < 40)
    elif req.scope == "nt":
        conditions.append(ClauseSyntax.book_num >= 40)
    elif req.scope == "pauline":
        conditions.append(ClauseSyntax.book.in_(_PAULINE_BOOKS))
    elif req.scope == "non-pauline":
        conditions.append(ClauseSyntax.book.notin_(_PAULINE_BOOKS))
    elif req.scope == "book" and req.book:
        conditions.append(ClauseSyntax.book == req.book)

    if req.lemma:
        conditions.append(ClauseSyntax.verb_lemma.ilike(f"%{req.lemma}%"))
    if req.strongs_num:
        conditions.append(ClauseSyntax.verb_strongs == req.strongs_num.upper())
    if req.keyword:
        like = f"%{req.keyword}%"
        conditions.append(or_(ClauseSyntax.clause_text.ilike(like), ClauseSyntax.metadata_json.ilike(like)))

    stmt = select(ClauseSyntax).order_by(
        ClauseSyntax.book_num,
        ClauseSyntax.chapter,
        ClauseSyntax.verse_start,
        ClauseSyntax.id,
    ).limit(req.limit)
    if conditions:
        stmt = stmt.where(and_(*conditions))

    clauses = (await db.execute(stmt)).scalars().all()
    results = []
    for clause in clauses:
        meta = _metadata(clause)
        verse = await db.execute(
            select(BibleVerse.text).where(
                BibleVerse.translation == "KJV",
                BibleVerse.book == clause.book,
                BibleVerse.chapter == clause.chapter,
                BibleVerse.verse == clause.verse_start,
            )
        )
        verse_text = verse.scalar_one_or_none() or meta.get("verse_text") or ""
        results.append({
            "type": "clause_syntax",
            "reference": f"{clause.book} {clause.chapter}:{clause.verse_start}",
            "book": clause.book,
            "chapter": clause.chapter,
            "verse_start": clause.verse_start,
            "verse_end": clause.verse_end,
            "clause_id": clause.clause_id,
            "clause_text": clause.clause_text,
            "role": clause.role,
            "verb_tense": clause.verb_tense,
            "verb_voice": clause.verb_voice,
            "verb_mood": clause.verb_mood,
            "verb_person": clause.verb_person,
            "verb_number": clause.verb_number,
            "verb_lemma": clause.verb_lemma,
            "verb_strongs": clause.verb_strongs,
            "compound_match": bool(req.keyword or req.lemma or req.strongs_num),
            "highlight": _highlight(clause.clause_text, verse_text),
            "verse_text": verse_text,
        })

    return {"query": _query_dict(req), "count": len(results), "results": results}
