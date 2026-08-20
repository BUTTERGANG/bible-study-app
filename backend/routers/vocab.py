"""Vocabulary Drills — serve word lists for flashcard drilling and track per-user mastery."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import GreekWord, HebrewWord, LexiconEntry, VocabMastery

router = APIRouter(prefix="/api/vocab", tags=["vocab"])

# NT book set for passage filtering
NT_BOOKS = {
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
    "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
    "Jude", "Revelation",
}


def _mastery_out(m: VocabMastery) -> dict:
    return {
        "id": m.id,
        "strongs_num": m.strongs_num,
        "language": m.language,
        "mastery_level": m.mastery_level,
        "attempts": m.attempts,
        "correct_count": m.correct_count,
        "last_reviewed": m.last_reviewed.isoformat() if m.last_reviewed else None,
        "added_at": m.added_at.isoformat(),
    }


@router.get("/drill")
async def get_drill_words(
    language: str = Query(default="greek", description="greek or hebrew"),
    limit: int = Query(default=20, ge=1, le=200),
    frequency_band: str = Query(
        default="top50",
        description="top50, top200, top500, all — filters by occurrence count",
    ),
    book: str | None = Query(default=None, description="Filter to words in this book"),
    chapter: int | None = Query(default=None, description="Filter to words in this chapter"),
    db: AsyncSession = Depends(get_db),
):
    """Return a list of vocab words for drilling, ordered by corpus frequency.

    Each item includes the original word, transliteration, definition (gloss),
    Strong's number, and an example verse reference.

    Frequency bands map to approximate corpus-occurrence thresholds:
      top50  → ≥100 occurrences
      top200 → ≥30 occurrences
      top500 → ≥10 occurrences
      all    → no minimum
    """
    min_occ = {"top50": 100, "top200": 30, "top500": 10, "all": 0}.get(frequency_band, 100)

    if language == "greek":
        model = GreekWord
    else:
        model = HebrewWord

    # Build frequency subquery: count occurrences per strongs_num
    freq_stmt = (
        select(model.strongs_num, func.count().label("occ_count"))
        .where(model.strongs_num.isnot(None))
        .where(model.strongs_num != "")
        .group_by(model.strongs_num)
    )
    if book:
        freq_stmt = freq_stmt.where(model.book == book)
        if chapter is not None:
            freq_stmt = freq_stmt.where(model.chapter == chapter)

    freq_result = await db.execute(freq_stmt)
    freq_rows = freq_result.all()

    # Filter by minimum occurrences
    qualifying = {
        row.strongs_num: row.occ_count
        for row in freq_rows
        if row.occ_count >= min_occ
    }

    if not qualifying:
        # Relax to all if passage filter left nothing
        qualifying = {row.strongs_num: row.occ_count for row in freq_rows}

    # Sort by frequency desc, take top `limit`
    top_strongs = sorted(qualifying, key=lambda s: qualifying[s], reverse=True)[:limit]

    if not top_strongs:
        return {"words": [], "language": language, "count": 0}

    # Fetch lexicon definitions
    lex_result = await db.execute(
        select(LexiconEntry).where(LexiconEntry.strongs_num.in_(top_strongs))
    )
    lex_entries = {e.strongs_num: e for e in lex_result.scalars().all()}

    # Fetch one representative word form + example verse for each strongs
    words = []
    for strongs_num in top_strongs:
        rep_result = await db.execute(
            select(model)
            .where(model.strongs_num == strongs_num)
            .limit(1)
        )
        rep = rep_result.scalar_one_or_none()
        if not rep:
            continue

        lex = lex_entries.get(strongs_num)

        original = getattr(rep, "greek" if language == "greek" else "hebrew")
        entry = {
            "strongs_num": strongs_num,
            "language": language,
            "original_word": original,
            "transliteration": rep.transliteration or "",
            "gloss": rep.english_gloss or "",
            "definition": lex.definition if lex else (rep.english_gloss or ""),
            "frequency": qualifying.get(strongs_num, 0),
            "example_verse": f"{rep.book} {rep.chapter}:{rep.verse}",
        }
        words.append(entry)

    return {"words": words, "language": language, "count": len(words)}


# ── Mastery endpoints ───────────────────────────────────────────────────────


class QuizResultRequest(BaseModel):
    strongs_num: str
    language: str  # "greek" | "hebrew"
    correct: bool


@router.get("/mastery")
async def list_mastery(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Return all vocab mastery records for the current user."""
    result = await db.execute(
        select(VocabMastery)
        .where(VocabMastery.user_id == user.id)
        .order_by(VocabMastery.mastery_level, VocabMastery.strongs_num)
    )
    rows = result.scalars().all()
    # Return as a dict keyed by "<language>:<strongs>" for fast frontend lookup
    by_key = {f"{m.language}:{m.strongs_num}": _mastery_out(m) for m in rows}
    return {"mastery": by_key, "count": len(rows)}


@router.post("/quiz")
async def record_vocab_quiz(
    body: QuizResultRequest,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Record a correct/incorrect result for a vocab drill card."""
    # Upsert mastery record
    result = await db.execute(
        select(VocabMastery).where(
            VocabMastery.user_id == user.id,
            VocabMastery.strongs_num == body.strongs_num,
            VocabMastery.language == body.language,
        )
    )
    mastery = result.scalar_one_or_none()

    if not mastery:
        mastery = VocabMastery(
            user_id=user.id,
            strongs_num=body.strongs_num,
            language=body.language,
        )
        db.add(mastery)

    mastery.attempts += 1
    mastery.last_reviewed = datetime.utcnow()
    if body.correct:
        mastery.correct_count += 1

    # Update mastery level using same progression as MemorizePanel
    if mastery.attempts >= 3:
        accuracy = mastery.correct_count / mastery.attempts
        if accuracy >= 0.9 and mastery.attempts >= 5:
            mastery.mastery_level = 3  # mastered
        elif accuracy >= 0.7:
            mastery.mastery_level = 2  # familiar
        else:
            mastery.mastery_level = 1  # learning
    elif mastery.attempts >= 1:
        mastery.mastery_level = 1

    await db.commit()
    await db.refresh(mastery)
    return _mastery_out(mastery)
