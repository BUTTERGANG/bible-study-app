"""Reading-plan management.

Schedule storage is normalized: each (plan, date, reference) is a row in
`reading_plan_days`. The previous design stored the whole schedule as a JSON
blob and deserialized it per request, which scaled poorly for chronological
plans (~365 entries) and made the `/today` endpoint do N+1 queries.
"""

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, delete, or_, select, tuple_
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..bible_data import BOOKS
from ..database import get_db
from ..models import ReadingPlan, ReadingPlanDay, ReadingPlanProgress

router = APIRouter(prefix="/api/reading-plans", tags=["reading-plans"])

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

    start_date = body.start_date or str(date.today())
    plan_def = BUILT_IN_PLANS[body.plan_type]

    plan = ReadingPlan(
        name=plan_def["name"],
        description=plan_def["description"],
        start_date=start_date,
    )
    db.add(plan)
    await db.flush()

    days = list(_generate_schedule(body.plan_type, start_date))
    if days:
        db.add_all([
            ReadingPlanDay(plan_id=plan.id, date=d, reference=ref)
            for d, ref in days
        ])
    await db.commit()
    await db.refresh(plan)
    return {"id": plan.id, "name": plan.name, "start_date": plan.start_date}


@router.delete("/{plan_id}")
async def delete_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(ReadingPlan).where(ReadingPlan.id == plan_id))
    await db.commit()
    return {"ok": True}


@router.get("/today")
async def get_today(db: AsyncSession = Depends(get_db)):
    today = str(date.today())

    # All entries for today across every plan, in one query.
    days_rows = await db.execute(
        select(ReadingPlanDay, ReadingPlan.name)
        .join(ReadingPlan, ReadingPlanDay.plan_id == ReadingPlan.id)
        .where(ReadingPlanDay.date == today)
    )
    days = days_rows.all()
    if not days:
        return {"date": today, "readings": []}

    # One IN-tuple lookup for matching progress rows.
    keys = [(d.plan_id, d.date, d.reference) for d, _ in days]
    progress_rows = await db.execute(
        select(ReadingPlanProgress).where(
            tuple_(
                ReadingPlanProgress.plan_id,
                ReadingPlanProgress.date,
                ReadingPlanProgress.reference,
            ).in_(keys)
        )
    )
    progress_by_key = {
        (p.plan_id, p.date, p.reference): p
        for p in progress_rows.scalars().all()
    }

    readings = []
    for d, plan_name in days:
        key = (d.plan_id, d.date, d.reference)
        prog = progress_by_key.get(key)
        readings.append({
            "plan_id": d.plan_id,
            "plan_name": plan_name,
            "reference": d.reference,
            "completed": prog is not None and prog.completed_at is not None,
            "progress_id": prog.id if prog else None,
        })

    return {"date": today, "readings": readings}


@router.post("/{plan_id}/complete")
async def complete_reading(
    plan_id: int,
    reference: str,
    db: AsyncSession = Depends(get_db),
):
    today = str(date.today())
    stmt = (
        sqlite_insert(ReadingPlanProgress)
        .values(
            plan_id=plan_id,
            date=today,
            reference=reference,
            completed_at=datetime.utcnow(),
        )
        .on_conflict_do_update(
            index_elements=["plan_id", "date", "reference"],
            # Toggle behavior: clear completed_at when re-marking the same day.
            set_={"completed_at": datetime.utcnow()},
        )
    )
    await db.execute(stmt)
    await db.commit()
    return {"completed": True}


def _generate_schedule(plan_type: str, start_date: str):
    """Yield (date_str, reference) tuples for the given plan."""
    start = date.fromisoformat(start_date)

    if plan_type == "psalms-proverbs":
        for day in range(31):
            d = str(start + timedelta(days=day))
            yield d, f"Psalms {day + 1}"
            yield d, f"Proverbs {day + 1}"
        return

    if plan_type == "nt-90":
        nt_chapters = [
            f"{b['name']} {ch}"
            for b in BOOKS if b["testament"] == "NT"
            for ch in range(1, b["chapters"] + 1)
        ]
        for i in range(90):
            d = str(start + timedelta(days=i))
            for ref in nt_chapters[i * 3:i * 3 + 3]:
                yield d, ref
        return

    if plan_type == "chronological":
        all_chapters = [
            f"{b['name']} {ch}"
            for b in BOOKS
            for ch in range(1, b["chapters"] + 1)
        ]
        total = len(all_chapters)
        per_day = total / 365
        for i in range(365):
            d = str(start + timedelta(days=i))
            for ref in all_chapters[int(i * per_day):int((i + 1) * per_day)]:
                yield d, ref
        return

    # mccheyne — simplified: 4 portions per day, sequential.
    all_chapters = [
        f"{b['name']} {ch}"
        for b in BOOKS
        for ch in range(1, b["chapters"] + 1)
    ]
    for i in range(365):
        d = str(start + timedelta(days=i))
        idx = i * 4
        for ref in all_chapters[idx:idx + 4]:
            yield d, ref
