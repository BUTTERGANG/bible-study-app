"""Doctrinal Topic Index — AI-generated systematic theology entries.

GET  /api/doctrine              — list all entries (with optional ?category= filter)
GET  /api/doctrine/{name}       — get or generate entry for a doctrine name
POST /api/doctrine/generate     — force-regenerate a doctrine entry
"""

import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai_client import get_client as _client
from ..auth import require_app_password
from ..database import get_db
from ..models import DoctrineEntry
from ..rate_limit import ai_rate_limit

router = APIRouter(
    prefix="/api/doctrine",
    tags=["doctrine"],
    dependencies=[Depends(require_app_password), Depends(ai_rate_limit)],
)

MODEL = "claude-sonnet-4-6"
CACHE_TTL_DAYS = 90


DOCTRINE_CATEGORIES = [
    "Theology Proper",
    "Christology",
    "Pneumatology",
    "Soteriology",
    "Ecclesiology",
    "Eschatology",
    "Anthropology",
    "Bibliology",
    "Angelology",
]

# 50 core doctrines seeded on startup
CORE_DOCTRINES: list[tuple[str, str]] = [
    # Theology Proper
    ("Trinity", "Theology Proper"),
    ("Attributes of God", "Theology Proper"),
    ("God's Sovereignty", "Theology Proper"),
    ("Divine Simplicity", "Theology Proper"),
    ("God's Omniscience", "Theology Proper"),
    ("God's Omnipresence", "Theology Proper"),
    ("God's Holiness", "Theology Proper"),
    # Christology
    ("Incarnation", "Christology"),
    ("Hypostatic Union", "Christology"),
    ("Atonement", "Christology"),
    ("Resurrection of Christ", "Christology"),
    ("Ascension of Christ", "Christology"),
    ("Second Coming", "Christology"),
    ("Messianic Prophecy", "Christology"),
    # Pneumatology
    ("Person of the Holy Spirit", "Pneumatology"),
    ("Baptism of the Holy Spirit", "Pneumatology"),
    ("Spiritual Gifts", "Pneumatology"),
    ("Fruit of the Spirit", "Pneumatology"),
    # Soteriology
    ("Justification", "Soteriology"),
    ("Sanctification", "Soteriology"),
    ("Glorification", "Soteriology"),
    ("Election and Predestination", "Soteriology"),
    ("Faith and Works", "Soteriology"),
    ("Grace", "Soteriology"),
    ("Repentance", "Soteriology"),
    ("Regeneration", "Soteriology"),
    ("Perseverance of the Saints", "Soteriology"),
    ("Total Depravity", "Soteriology"),
    # Ecclesiology
    ("Church", "Ecclesiology"),
    ("Baptism", "Ecclesiology"),
    ("Lord's Supper", "Ecclesiology"),
    ("Church Government", "Ecclesiology"),
    ("Spiritual Authority", "Ecclesiology"),
    # Eschatology
    ("Heaven", "Eschatology"),
    ("Hell", "Eschatology"),
    ("Final Judgment", "Eschatology"),
    ("Millennium", "Eschatology"),
    ("Rapture", "Eschatology"),
    ("New Creation", "Eschatology"),
    # Anthropology
    ("Image of God (Imago Dei)", "Anthropology"),
    ("Sin", "Anthropology"),
    ("Original Sin", "Anthropology"),
    ("Human Soul", "Anthropology"),
    ("Free Will", "Anthropology"),
    # Bibliology
    ("Inspiration of Scripture", "Bibliology"),
    ("Inerrancy", "Bibliology"),
    ("Canon of Scripture", "Bibliology"),
    # Angelology
    ("Angels", "Angelology"),
    ("Spiritual Warfare", "Angelology"),
    ("Satan and Demons", "Angelology"),
]

DOCTRINE_PROMPT = """You are a systematic theologian writing a doctrinal reference entry for **{name}** (category: {category}).

Return a JSON object with exactly these keys:
{{
  "name": "{name}",
  "category": "{category}",
  "definition": "A clear 2–3 sentence definition of this doctrine.",
  "key_verses": [
    {{"ref": "Book Chapter:Verse", "note": "brief explanation"}},
    ...5–10 entries...
  ],
  "summary": "A 3–5 paragraph systematic summary covering the biblical basis, theological development, and significance of this doctrine.",
  "positions": {{
    "Reformed": "Brief summary of the Reformed/Calvinist position.",
    "Arminian": "Brief summary of the Arminian/Wesleyan position.",
    "Catholic": "Brief summary of the Roman Catholic position.",
    "Orthodox": "Brief summary of the Eastern Orthodox position (if distinct)."
  }},
  "related_doctrines": ["Doctrine A", "Doctrine B", "Doctrine C"]
}}

Return ONLY the JSON object — no markdown fences, no explanation."""


async def _generate_doctrine(name: str, category: str) -> str:
    client = _client()
    response = await client.messages.create(
        model=MODEL,
        max_tokens=1800,
        system=[{
            "type": "text",
            "text": "You are an expert systematic theologian. Always respond with valid JSON only.",
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{
            "role": "user",
            "content": DOCTRINE_PROMPT.format(name=name, category=category),
        }],
    )
    raw = response.content[0].text.strip()
    # Validate it's parseable JSON
    try:
        json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1:
            raw = raw[start:end]
        else:
            raise HTTPException(status_code=500, detail="AI returned invalid JSON.") from None
    return raw


class GenerateRequest(BaseModel):
    name: str
    category: str = "Theology Proper"


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("")
async def list_doctrines(
    category: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Search by name"),
    db: AsyncSession = Depends(get_db),
):
    """Return all doctrine entries, optionally filtered by category or search query."""
    stmt = select(DoctrineEntry).order_by(DoctrineEntry.category, DoctrineEntry.name)
    if category:
        stmt = stmt.where(DoctrineEntry.category == category)
    if q:
        stmt = stmt.where(DoctrineEntry.name.ilike(f"%{q}%"))
    result = await db.execute(stmt)
    entries = result.scalars().all()
    return {
        "categories": DOCTRINE_CATEGORIES,
        "core_doctrines": [{"name": n, "category": c} for n, c in CORE_DOCTRINES],
        "entries": [
            {
                "id": e.id,
                "name": e.name,
                "category": e.category,
                "generated_at": e.generated_at.isoformat(),
            }
            for e in entries
        ],
        "total": len(entries),
    }


@router.post("/generate")
async def force_generate(req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    """Force-regenerate a doctrine entry (ignores cache)."""
    content = await _generate_doctrine(req.name, req.category)
    now = datetime.now(UTC)

    result = await db.execute(
        select(DoctrineEntry).where(DoctrineEntry.name == req.name)
    )
    entry = result.scalar_one_or_none()
    if entry:
        entry.content = content
        entry.category = req.category
        entry.updated_at = now
    else:
        entry = DoctrineEntry(
            name=req.name,
            category=req.category,
            content=content,
            generated_at=now,
            updated_at=now,
        )
        db.add(entry)

    await db.commit()
    await db.refresh(entry)
    return {"name": entry.name, "category": entry.category, "content": json.loads(entry.content)}


@router.get("/{name}")
async def get_doctrine(
    name: str,
    refresh: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    """Return a cached doctrine entry or generate on-the-fly."""
    result = await db.execute(
        select(DoctrineEntry).where(DoctrineEntry.name.ilike(name))
    )
    entry = result.scalar_one_or_none()

    # generated_at is read back from SQLite as a naive datetime, so compare
    # against a naive UTC "now" to avoid an aware/naive subtraction TypeError.
    stale = (
        entry
        and entry.generated_at is not None
        and (datetime.utcnow() - entry.generated_at) > timedelta(days=CACHE_TTL_DAYS)
    )

    if entry and not refresh and not stale:
        return {"name": entry.name, "category": entry.category, "content": json.loads(entry.content)}

    # Determine category — look up from seed list or default
    category = next((c for n, c in CORE_DOCTRINES if n.lower() == name.lower()), "Theology Proper")
    if entry:
        category = entry.category

    content = await _generate_doctrine(name, category)
    now = datetime.now(UTC)

    if entry:
        entry.content = content
        entry.updated_at = now
    else:
        entry = DoctrineEntry(
            name=name,
            category=category,
            content=content,
            generated_at=now,
            updated_at=now,
        )
        db.add(entry)

    await db.commit()
    await db.refresh(entry)
    return {"name": entry.name, "category": entry.category, "content": json.loads(entry.content)}
