"""Pastoral counseling guides — AI-generated biblical guidance organized by life issue.

GET  /api/counseling            — list all guides (with ?category= filter)
GET  /api/counseling/{name}     — get or generate a guide for a specific issue
POST /api/counseling/generate   — force-regenerate a guide
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai_client import get_client as _client
from ..auth import require_app_password
from ..database import get_db
from ..models import CounselingGuide
from ..rate_limit import ai_rate_limit

logger = logging.getLogger("bible-study.counseling")

router = APIRouter(
    prefix="/api/counseling",
    tags=["counseling"],
    dependencies=[Depends(require_app_password), Depends(ai_rate_limit)],
)

MODEL = "claude-sonnet-4-6"
CACHE_TTL_DAYS = 90

COUNSELING_CATEGORIES = [
    "Anxiety & Fear",
    "Grief & Loss",
    "Addiction & Recovery",
    "Marriage & Relationships",
    "Depression & Mental Health",
    "Forgiveness",
    "Identity & Purpose",
    "Anger & Conflict",
    "Financial Stress",
    "Parenting",
    "Loneliness",
    "Doubt & Faith",
    "Trauma & Abuse",
    "End of Life",
    "Spiritual Dryness",
]

# 40 core issues seeded on startup
CORE_ISSUES: list[tuple[str, str]] = [
    ("Anxiety", "Anxiety & Fear"),
    ("Fear", "Anxiety & Fear"),
    ("Panic Attacks", "Anxiety & Fear"),
    ("Worry", "Anxiety & Fear"),
    ("Grief", "Grief & Loss"),
    ("Death of a Loved One", "Grief & Loss"),
    ("Miscarriage", "Grief & Loss"),
    ("Divorce Recovery", "Grief & Loss"),
    ("Alcohol Addiction", "Addiction & Recovery"),
    ("Drug Addiction", "Addiction & Recovery"),
    ("Pornography Addiction", "Addiction & Recovery"),
    ("Gambling Addiction", "Addiction & Recovery"),
    ("Marriage Conflict", "Marriage & Relationships"),
    ("Infidelity", "Marriage & Relationships"),
    ("Loneliness in Marriage", "Marriage & Relationships"),
    ("Singleness", "Marriage & Relationships"),
    ("Depression", "Depression & Mental Health"),
    ("Suicidal Thoughts", "Depression & Mental Health"),
    ("Burnout", "Depression & Mental Health"),
    ("Forgiving Others", "Forgiveness"),
    ("Self-Forgiveness", "Forgiveness"),
    ("Unforgiveness and Bitterness", "Forgiveness"),
    ("Identity in Christ", "Identity & Purpose"),
    ("Finding Purpose", "Identity & Purpose"),
    ("Low Self-Worth", "Identity & Purpose"),
    ("Anger", "Anger & Conflict"),
    ("Conflict Resolution", "Anger & Conflict"),
    ("Bitterness", "Anger & Conflict"),
    ("Financial Debt", "Financial Stress"),
    ("Generosity and Tithing", "Financial Stress"),
    ("Prodigal Children", "Parenting"),
    ("Parenting Teenagers", "Parenting"),
    ("Isolation", "Loneliness"),
    ("Intellectual Doubt", "Doubt & Faith"),
    ("Deconstruction", "Doubt & Faith"),
    ("Childhood Trauma", "Trauma & Abuse"),
    ("Abuse Recovery", "Trauma & Abuse"),
    ("Facing Death", "End of Life"),
    ("Caregiver Fatigue", "End of Life"),
    ("Spiritual Dryness", "Spiritual Dryness"),
]


def _build_prompt(name: str) -> str:
    return f"""You are a biblical pastoral counselor with deep knowledge of Scripture and evidence-based counseling approaches. Provide a comprehensive pastoral counseling guide for: "{name}".

Return ONLY valid JSON (no markdown, no preamble):
{{
  "issue": "<exact issue name>",
  "category": "<category>",
  "overview": "<2-3 sentence pastoral overview — compassionate, biblical>",
  "key_scriptures": [
    {{"reference": "<Book Ch:Vs>", "text": "<verse text>", "application": "<how it applies>"}}
  ],
  "biblical_perspective": "<paragraph on what Scripture says about this issue>",
  "practical_steps": [
    {{"step": "<action>", "description": "<brief explanation>", "scripture_support": "<reference>"}}
  ],
  "prayer_points": ["<prayer prompt 1>", "<prayer prompt 2>", "<prayer prompt 3>"],
  "when_to_seek_help": "<guidance on when professional counseling or medical care is appropriate>",
  "resources": ["<book or resource recommendation>"]
}}

Use 4–6 key scriptures, 3–5 practical steps, and 3 prayer points. Be compassionate and theologically sound."""


async def _generate_guide(name: str, db: AsyncSession) -> CounselingGuide:
    category = "General"
    for issue, cat in CORE_ISSUES:
        if issue.lower() == name.lower():
            category = cat
            break
    else:
        for cat_name in COUNSELING_CATEGORIES:
            if cat_name.lower() in name.lower():
                category = cat_name
                break

    client = _client()
    try:
        msg = await client.messages.create(
            model=MODEL,
            max_tokens=1200,
            messages=[{"role": "user", "content": _build_prompt(name)}],
        )
        text = msg.content[0].text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    except Exception as exc:
        logger.warning("Counseling guide generation failed for %s: %s", name, exc)
        raise HTTPException(status_code=503, detail="AI generation failed; try again later") from exc

    guide = CounselingGuide(name=name, category=category, content=text)
    db.add(guide)
    await db.commit()
    await db.refresh(guide)
    return guide


def _guide_dict(g: CounselingGuide, parse_content: bool = True) -> dict:
    content = g.content
    if parse_content:
        try:
            content = json.loads(g.content)
        except (json.JSONDecodeError, TypeError):
            content = {"raw": g.content}
    return {
        "id": g.id,
        "name": g.name,
        "category": g.category,
        "content": content,
        "generated_at": g.generated_at.isoformat() if g.generated_at else None,
        "updated_at": g.updated_at.isoformat() if g.updated_at else None,
    }


@router.get("")
async def list_guides(
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(CounselingGuide)
    if category:
        q = q.where(CounselingGuide.category == category)
    q = q.order_by(CounselingGuide.category, CounselingGuide.name)
    result = await db.execute(q)
    guides = result.scalars().all()

    counts_q = await db.execute(
        select(CounselingGuide.category, func.count())
        .group_by(CounselingGuide.category)
        .order_by(CounselingGuide.category)
    )
    category_counts = [{"category": c, "count": n} for c, n in counts_q.all()]

    return {
        "guides": [_guide_dict(g, parse_content=False) for g in guides],
        "categories": COUNSELING_CATEGORIES,
        "category_counts": category_counts,
    }


@router.get("/{name}")
async def get_guide(name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CounselingGuide).where(CounselingGuide.name == name)
    )
    guide = result.scalar_one_or_none()

    if guide:
        cutoff = datetime.now(timezone.utc) - timedelta(days=CACHE_TTL_DAYS)
        updated = guide.updated_at
        if updated and updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        if updated and updated < cutoff:
            await db.execute(delete(CounselingGuide).where(CounselingGuide.name == name))
            await db.commit()
            guide = None

    if not guide:
        guide = await _generate_guide(name, db)

    return _guide_dict(guide)


class RegenerateRequest(BaseModel):
    name: str


@router.post("/generate")
async def regenerate_guide(body: RegenerateRequest, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(CounselingGuide).where(CounselingGuide.name == body.name))
    await db.commit()
    guide = await _generate_guide(body.name, db)
    return _guide_dict(guide)
