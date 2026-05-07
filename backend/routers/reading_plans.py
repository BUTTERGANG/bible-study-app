import json
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import ReadingPlan, ReadingPlanProgress

router = APIRouter(prefix="/api/reading-plans", tags=["reading-plans"])

# Built-in plan definitions
BUILT_IN_PLANS = {
    "mccheyne": {
        "name": "M'Cheyne Bible Reading Plan",
        "description": "Read the Bible in a year with 4 portions daily (NT, Psalms, OT x2)",
    },
    "nt-90": {
        "name": "New Testament in 90 Days",
        "description": "Complete the New Testament in 3 months",
    },
    "psalms-proverbs": {
        "name": "Psalms & Proverbs Monthly",
        "description": "Read through Psalms and Proverbs each month",
    },
    "chronological": {
        "name": "Chronological Bible",
        "description": "Read the Bible in chronological order over 1 year",
    },
}


@router.get("/built-in")
async def list_built_in_plans():
    return {"plans": [{"id": k, **v} for k, v in BUILT_IN_PLANS.items()]}


@router.get("")
async def list_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ReadingPlan).order_by(ReadingPlan.created_at.desc()))
    plans = result.scalars().all()
    return {
        "plans": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "start_date": p.start_date,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in plans
        ]
    }


class PlanStart(BaseModel):
    plan_type: str
    start_date: Optional[str] = None


@router.post("/start")
async def start_plan(body: PlanStart, db: AsyncSession = Depends(get_db)):
    if body.plan_type not in BUILT_IN_PLANS:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan_type}")

    plan_def = BUILT_IN_PLANS[body.plan_type]
    schedule = _generate_schedule(body.plan_type, body.start_date or str(date.today()))

    plan = ReadingPlan(
        name=plan_def["name"],
        description=plan_def["description"],
        schedule_json=json.dumps(schedule),
        start_date=body.start_date or str(date.today()),
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return {"id": plan.id, "name": plan.name, "start_date": plan.start_date}


@router.get("/today")
async def get_today(db: AsyncSession = Depends(get_db)):
    today = str(date.today())
    result = await db.execute(select(ReadingPlan).order_by(ReadingPlan.created_at.desc()))
    plans = result.scalars().all()

    today_readings = []
    for plan in plans:
        schedule = json.loads(plan.schedule_json)
        if today in schedule:
            for ref in schedule[today]:
                prog_result = await db.execute(
                    select(ReadingPlanProgress).where(
                        ReadingPlanProgress.plan_id == plan.id,
                        ReadingPlanProgress.date == today,
                        ReadingPlanProgress.reference == ref,
                    )
                )
                prog = prog_result.scalar_one_or_none()
                today_readings.append({
                    "plan_id": plan.id,
                    "plan_name": plan.name,
                    "reference": ref,
                    "completed": prog is not None and prog.completed_at is not None,
                    "progress_id": prog.id if prog else None,
                })

    return {"date": today, "readings": today_readings}


@router.post("/{plan_id}/complete")
async def complete_reading(
    plan_id: int,
    reference: str,
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    today = str(date.today())

    result = await db.execute(
        select(ReadingPlanProgress).where(
            ReadingPlanProgress.plan_id == plan_id,
            ReadingPlanProgress.date == today,
            ReadingPlanProgress.reference == reference,
        )
    )
    prog = result.scalar_one_or_none()
    if not prog:
        prog = ReadingPlanProgress(
            plan_id=plan_id,
            date=today,
            reference=reference,
            completed_at=datetime.utcnow(),
        )
        db.add(prog)
    else:
        prog.completed_at = datetime.utcnow() if not prog.completed_at else None
    await db.commit()
    return {"completed": prog.completed_at is not None}


def _generate_schedule(plan_type: str, start_date: str) -> dict:
    """Generate a date→[references] schedule for built-in plans."""
    from bible_data import BOOKS
    schedule = {}
    start = date.fromisoformat(start_date)

    if plan_type == "psalms-proverbs":
        for day in range(31):
            d = start + timedelta(days=day)
            psalm = day + 1
            proverb = day + 1
            schedule[str(d)] = [f"Psalms {psalm}", f"Proverbs {proverb}"]

    elif plan_type == "nt-90":
        nt_books = [b for b in BOOKS if b["testament"] == "NT"]
        all_chapters = []
        for book in nt_books:
            for ch in range(1, book["chapters"] + 1):
                all_chapters.append(f"{book['name']} {ch}")
        # ~2.9 chapters per day
        for i in range(90):
            d = start + timedelta(days=i)
            start_idx = i * 3
            end_idx = min(start_idx + 3, len(all_chapters))
            if start_idx < len(all_chapters):
                schedule[str(d)] = all_chapters[start_idx:end_idx]

    elif plan_type == "chronological":
        # Simplified chronological order
        all_chapters = []
        for book in BOOKS:
            for ch in range(1, book["chapters"] + 1):
                all_chapters.append(f"{book['name']} {ch}")
        total = len(all_chapters)
        per_day = total / 365
        for i in range(365):
            d = start + timedelta(days=i)
            start_idx = int(i * per_day)
            end_idx = int((i + 1) * per_day)
            schedule[str(d)] = all_chapters[start_idx:end_idx]

    else:  # mccheyne — simplified
        all_chapters = []
        for book in BOOKS:
            for ch in range(1, book["chapters"] + 1):
                all_chapters.append(f"{book['name']} {ch}")
        for i in range(365):
            d = start + timedelta(days=i)
            idx = i * 4
            schedule[str(d)] = all_chapters[idx:idx + 4] if idx < len(all_chapters) else []

    return schedule
