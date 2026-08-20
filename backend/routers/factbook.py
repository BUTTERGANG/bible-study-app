"""Factbook — AI-generated encyclopedia for biblical people, places, themes, and events.

GET /api/factbook/{entity}  — returns cached entry or generates on-the-fly
POST /api/factbook/generate — force-regenerate an entity
GET /api/factbook           — list/search entries
"""

import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai_client import get_client as _client
from ..auth import require_app_password
from ..database import get_db
from ..models import FactbookEntry
from ..rate_limit import ai_rate_limit

router = APIRouter(
    prefix="/api/factbook",
    tags=["factbook"],
    dependencies=[Depends(require_app_password), Depends(ai_rate_limit)],
)

MODEL = "claude-sonnet-4-6"
_CACHE = {"type": "ephemeral"}

# Cache TTL — entries older than this are regenerated
CACHE_TTL_DAYS = 30


# ── Entity type prompts ────────────────────────────────────────────────────

PERSON_PROMPT = """You are a biblical scholar creating an encyclopedia entry for a factbook.
Create a comprehensive, well-structured entry for the biblical person: **{entity}**

Use markdown formatting. Include these sections:

## Overview
Brief introduction — who they are and why they matter in the biblical narrative.

## Key Passages
List 5-10 key Scripture references with brief notes on what each passage reveals about this person.

## Timeline
A chronological overview of their life events as recorded in Scripture (use approximate dates where exact dates are unknown).

## Relationships
Key family members, allies, and adversaries. Show the relational network.

## Theological Significance
How does this person contribute to the overall biblical narrative? What theological themes are associated with them?

## Cultural Context
Historical and cultural background — what was happening in the ancient world during their lifetime?

## Key Lessons
What can we learn from this person's life, faith, faithfulness, or failures?

Be thorough but concise. Cite specific Bible verses using standard notation (Book Chapter:Verse)."""

PLACE_PROMPT = """You are a biblical scholar creating an encyclopedia entry for a factbook.
Create a comprehensive, well-structured entry for the biblical place: **{entity}**

Use markdown formatting. Include these sections:

## Overview
Brief introduction — where it is and why it matters in the biblical narrative.

## Key Passages
List 5-10 key Scripture references with brief notes on what each passage reveals about this place.

## Biblical Events
Major events that happened at or near this place, in chronological order.

## Geographical Context
Where is it located? What is the terrain, climate, and strategic significance?

## Theological Significance
What theological themes are associated with this place? How does it contribute to the biblical narrative?

## Archaeological Notes
Any relevant archaeological findings or historical evidence (if known).

Be thorough but concise. Cite specific Bible verses using standard notation (Book Chapter:Verse)."""

THEME_PROMPT = """You are a biblical scholar creating an encyclopedia entry for a factbook.
Create a comprehensive, well-structured entry for the biblical theme/topic: **{entity}**

Use markdown formatting. Include these sections:

## Overview
Define the theme and explain its importance in the biblical narrative.

## Old Testament Foundation
How does the Old Testament introduce and develop this theme? Key passages and examples.

## New Testament Development
How does the New Testament expand, fulfill, or transform this theme?

## Key Passages
List 10-15 of the most important verses related to this theme, organized by Testament.

## Theological Summary
A systematic summary of the biblical teaching on this theme.

## Practical Application
How should this theme shape Christian belief and practice today?

## Cross-References to Related Themes
What other biblical themes connect to this one?

Be thorough but concise. Cite specific Bible verses using standard notation (Book Chapter:Verse)."""

EVENT_PROMPT = """You are a biblical scholar creating an encyclopedia entry for a factbook.
Create a comprehensive, well-structured entry for the biblical event: **{entity}**

Use markdown formatting. Include these sections:

## Overview
Brief description of the event and its significance.

## Key Passages
The primary Scripture references that describe this event.

## Historical Context
What was happening historically when this event occurred?

## Event Details
A detailed narrative of what happened, drawing from all relevant biblical accounts.

## Theological Significance
Why does this event matter for the biblical narrative and Christian theology?

## Consequences and Impact
What were the immediate and long-term consequences of this event?

## Connections
How does this event connect to other biblical events, themes, or prophecies?

Be thorough but concise. Cite specific Bible verses using standard notation (Book Chapter:Verse)."""

TYPE_PROMPTS = {
    "person": PERSON_PROMPT,
    "place": PLACE_PROMPT,
    "theme": THEME_PROMPT,
    "event": EVENT_PROMPT,
}


class GenerateRequest(BaseModel):
    entity_name: str
    entity_type: str = "person"  # person, place, theme, event


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/{entity_name}/questions")
async def get_factbook_questions(
    entity_name: str,
    entity_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Return 5 AI-generated study questions about a factbook entity."""
    result = await db.execute(
        select(FactbookEntry).where(FactbookEntry.entity_name.ilike(entity_name))
    )
    entry = result.scalar_one_or_none()
    content_snippet = entry.content[:1500] if entry else ""
    resolved_type = (entity_type or (entry.entity_type if entry else "person"))

    client = _client()
    response = await client.messages.create(
        model=MODEL,
        max_tokens=400,
        messages=[{
            "role": "user",
            "content": f"""Generate exactly 5 insightful Bible study questions about {entity_name} ({resolved_type}).
These should prompt personal reflection and deeper study.
{f"Context from factbook entry:{chr(10)}{content_snippet}" if content_snippet else ""}

Respond ONLY with a JSON array of 5 question strings. No markdown, no explanation.
Example: ["Question one?", "Question two?", ...]""",
        }],
    )
    raw = response.content[0].text.strip()
    try:
        questions = json.loads(raw)
        if not isinstance(questions, list):
            questions = []
    except json.JSONDecodeError:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        try:
            questions = json.loads(raw[start:end]) if start != -1 else []
        except json.JSONDecodeError:
            questions = []

    return {"entity_name": entity_name, "questions": questions[:5]}


@router.get("/{entity_name}")
async def get_factbook_entry(
    entity_name: str,
    entity_type: str | None = Query(default=None, description="person, place, theme, or event"),
    refresh: bool = Query(default=False, description="Force regeneration even if cached"),
    db: AsyncSession = Depends(get_db),
):
    """Return a cached factbook entry or generate one on-the-fly.

    If entity_type is not provided, search across all types.
    If no cached entry exists (or it's older than CACHE_TTL_DAYS), generate via AI.
    """
    # Look for cached entry
    query = select(FactbookEntry).where(FactbookEntry.entity_name.ilike(entity_name))
    if entity_type:
        query = query.where(FactbookEntry.entity_type == entity_type)

    result = await db.execute(query)
    entry = result.scalar_one_or_none()

    # Return cached entry if fresh and not forcing refresh
    if entry and not refresh:
        # SQLite returns naive datetimes; make comparison timezone-safe
        gen_at = entry.generated_at
        if gen_at.tzinfo is None:
            gen_at = gen_at.replace(tzinfo=UTC)
        age = datetime.now(UTC) - gen_at
        if age < timedelta(days=CACHE_TTL_DAYS):
            return {
                "entity_name": entry.entity_name,
                "entity_type": entry.entity_type,
                "content": entry.content,
                "generated_at": entry.generated_at.isoformat(),
                "cached": True,
            }

    # Determine entity type if not provided
    resolved_type = entity_type
    if not resolved_type:
        if entry:
            resolved_type = entry.entity_type
        else:
            resolved_type = await _classify_entity(entity_name)

    # Generate new entry
    content = await _generate_entry(entity_name, resolved_type)

    # Upsert into DB
    if entry:
        entry.content = content
        entry.generated_at = datetime.now(UTC)
        entry.entity_type = resolved_type
    else:
        entry = FactbookEntry(
            entity_name=entity_name.title() if resolved_type == "person" else entity_name,
            entity_type=resolved_type,
            content=content,
        )
        db.add(entry)

    await db.commit()

    return {
        "entity_name": entry.entity_name,
        "entity_type": entry.entity_type,
        "content": content,
        "generated_at": entry.generated_at.isoformat(),
        "cached": False,
    }


@router.post("/generate")
async def force_generate(request: GenerateRequest, db: AsyncSession = Depends(get_db)):
    """Force-regenerate a factbook entry (bypasses cache)."""
    content = await _generate_entry(request.entity_name, request.entity_type)

    result = await db.execute(
        select(FactbookEntry).where(
            FactbookEntry.entity_name.ilike(request.entity_name),
            FactbookEntry.entity_type == request.entity_type,
        )
    )
    entry = result.scalar_one_or_none()

    if entry:
        entry.content = content
        entry.generated_at = datetime.now(UTC)
    else:
        entry = FactbookEntry(
            entity_name=request.entity_name,
            entity_type=request.entity_type,
            content=content,
        )
        db.add(entry)

    await db.commit()

    return {
        "entity_name": entry.entity_name,
        "entity_type": entry.entity_type,
        "content": content,
        "generated_at": entry.generated_at.isoformat(),
        "cached": False,
    }


@router.get("")
async def list_entries(
    entity_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
):
    """List factbook entries with optional filtering."""
    query = select(FactbookEntry)

    if entity_type:
        query = query.where(FactbookEntry.entity_type == entity_type)
    if search:
        query = query.where(FactbookEntry.entity_name.ilike(f"%{search}%"))

    query = query.order_by(FactbookEntry.entity_name).offset(offset).limit(limit)

    result = await db.execute(query)
    entries = result.scalars().all()

    return {
        "entries": [
            {
                "entity_name": e.entity_name,
                "entity_type": e.entity_type,
                "generated_at": e.generated_at.isoformat(),
                "updated_at": e.updated_at.isoformat(),
            }
            for e in entries
        ],
        "count": len(entries),
    }


# ── AI helpers ─────────────────────────────────────────────────────────────

async def _classify_entity(entity_name: str) -> str:
    """Use AI to classify an entity as person, place, theme, or event."""
    client = _client()
    response = await client.messages.create(
        model=MODEL,
        max_tokens=20,
        messages=[{
            "role": "user",
            "content": f"""Classify this biblical entity as exactly one of: person, place, theme, event.

Entity: "{entity_name}"

Respond with ONLY the single word: person, place, theme, or event.""",
        }],
    )
    text = response.content[0].text.strip().lower()
    for t in ("person", "place", "theme", "event"):
        if t in text:
            return t
    return "theme"  # default


async def _generate_entry(entity_name: str, entity_type: str) -> str:
    """Generate a factbook entry using Claude."""
    template = TYPE_PROMPTS.get(entity_type, TYPE_PROMPTS["theme"])
    prompt = template.format(entity=entity_name)

    client = _client()
    response = await client.messages.create(
        model=MODEL,
        max_tokens=4000,
        system="You are a knowledgeable biblical scholar creating encyclopedia entries for a Bible study application. Be thorough, accurate, and cite specific Bible verses.",
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text
