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

from ..auth import CurrentUser, get_current_user
from ..bible_data import BOOKS
from ..database import get_db
from ..models import ReadingPlan, ReadingPlanDay, ReadingPlanProgress

router = APIRouter(prefix="/api/reading-plans", tags=["reading-plans"])


# ──────────────────────────────────────────────────────────────────
# Extended built-in plan templates (80+ seed plans)
# ──────────────────────────────────────────────────────────────────

BUILTIN_PLAN_TEMPLATES = [
    # Classic plans
    {"id": "bible-365", "name": "Bible in a Year", "description": "Read the entire Bible in 365 days (~3 chapters/day)", "category": "complete", "duration": 365},
    {"id": "bible-180", "name": "Bible in 6 Months", "description": "Read the entire Bible in 180 days (~6 chapters/day)", "category": "complete", "duration": 180},
    {"id": "bible-90", "name": "Bible in 90 Days", "description": "Read the entire Bible in 90 days (~12 chapters/day)", "category": "complete", "duration": 90},
    {"id": "bible-30", "name": "Bible in 30 Days", "description": "Read the entire Bible in 30 days (~40 chapters/day)", "category": "complete", "duration": 30},
    # New Testament
    {"id": "nt-90", "name": "New Testament in 90 Days", "description": "Complete the New Testament in 3 months", "category": "new-testament", "duration": 90},
    {"id": "nt-60", "name": "New Testament in 60 Days", "description": "Complete the New Testament in 2 months", "category": "new-testament", "duration": 60},
    {"id": "nt-30", "name": "New Testament in 30 Days", "description": "Complete the New Testament in 1 month", "category": "new-testament", "duration": 30},
    {"id": "nt-21", "name": "New Testament in 21 Days", "description": "Complete the New Testament in 3 weeks", "category": "new-testament", "duration": 21},
    # Gospels
    {"id": "gospels-30", "name": "The Four Gospels in 30 Days", "description": "Read Matthew, Mark, Luke, and John in one month", "category": "gospels", "duration": 30},
    {"id": "gospels-14", "name": "The Four Gospels in 14 Days", "description": "Read all four Gospels in two weeks", "category": "gospels", "duration": 14},
    {"id": "matthew-15", "name": "Gospel of Matthew in 15 Days", "description": "Read Matthew's Gospel in half a month", "category": "gospels", "duration": 15},
    {"id": "mark-7", "name": "Gospel of Mark in 7 Days", "description": "Read Mark's Gospel in one week", "category": "gospels", "duration": 7},
    {"id": "luke-12", "name": "Gospel of Luke in 12 Days", "description": "Read Luke's Gospel in 12 days", "category": "gospels", "duration": 12},
    {"id": "john-10", "name": "Gospel of John in 10 Days", "description": "Read John's Gospel in 10 days", "category": "gospels", "duration": 10},
    # Old Testament
    {"id": "ot-180", "name": "Old Testament in 180 Days", "description": "Complete the Old Testament in 6 months", "category": "old-testament", "duration": 180},
    {"id": "ot-90", "name": "Old Testament in 90 Days", "description": "Complete the Old Testament in 3 months", "category": "old-testament", "duration": 90},
    {"id": "ot-60", "name": "Old Testament in 60 Days", "description": "Complete the Old Testament in 2 months", "category": "old-testament", "duration": 60},
    # Pentateuch
    {"id": "pentateuch-30", "name": "Pentateuch in 30 Days", "description": "Read Genesis through Deuteronomy in one month", "category": "pentateuch", "duration": 30},
    {"id": "pentateuch-15", "name": "Pentateuch in 15 Days", "description": "Read the first five books of Moses in two weeks", "category": "pentateuch", "duration": 15},
    {"id": "genesis-10", "name": "Genesis in 10 Days", "description": "Read Genesis in 10 days", "category": "pentateuch", "duration": 10},
    {"id": "exodus-8", "name": "Exodus in 8 Days", "description": "Read Exodus in 8 days", "category": "pentateuch", "duration": 8},
    # Wisdom literature
    {"id": "psalms-30", "name": "Psalms in 30 Days", "description": "Read through all 150 Psalms in one month (5/day)", "category": "wisdom", "duration": 30},
    {"id": "psalms-15", "name": "Psalms in 15 Days", "description": "Read through all 150 Psalms in two weeks (10/day)", "category": "wisdom", "duration": 15},
    {"id": "psalms-7", "name": "Psalms in 7 Days", "description": "Read through all 150 Psalms in one week", "category": "wisdom", "duration": 7},
    {"id": "proverbs-31", "name": "Proverbs in 31 Days", "description": "Read one chapter of Proverbs per day for a month", "category": "wisdom", "duration": 31},
    {"id": "proverbs-15", "name": "Proverbs in 15 Days", "description": "Read two chapters of Proverbs per day for two weeks", "category": "wisdom", "duration": 15},
    {"id": "ecclesiastes-6", "name": "Ecclesiastes in 6 Days", "description": "Read Ecclesiastes in 6 days", "category": "wisdom", "duration": 6},
    {"id": "song-4", "name": "Song of Solomon in 4 Days", "description": "Read Song of Solomon in 4 days", "category": "wisdom", "duration": 4},
    {"id": "wisdom-30", "name": "Wisdom Literature in 30 Days", "description": "Read Job, Psalms, Proverbs, Ecclesiastes, and Song of Solomon", "category": "wisdom", "duration": 30},
    # Prophets
    {"id": "major-prophets-30", "name": "Major Prophets in 30 Days", "description": "Read Isaiah, Jeremiah, Lamentations, Ezekiel, and Daniel", "category": "prophets", "duration": 30},
    {"id": "minor-prophets-14", "name": "Minor Prophets in 14 Days", "description": "Read all 12 Minor Prophets in two weeks", "category": "prophets", "duration": 14},
    {"id": "minor-prophets-7", "name": "Minor Prophets in 7 Days", "description": "Read all 12 Minor Prophets in one week", "category": "prophets", "duration": 7},
    {"id": "isaiah-16", "name": "Isaiah in 16 Days", "description": "Read Isaiah in 16 days (~4 chapters/day)", "category": "prophets", "duration": 16},
    {"id": "jeremiah-13", "name": "Jeremiah in 13 Days", "description": "Read Jeremiah in 13 days (~4 chapters/day)", "category": "prophets", "duration": 13},
    {"id": "ezekiel-12", "name": "Ezekiel in 12 Days", "description": "Read Ezekiel in 12 days (~4 chapters/day)", "category": "prophets", "duration": 12},
    {"id": "daniel-6", "name": "Daniel in 6 Days", "description": "Read Daniel in 6 days (~2 chapters/day)", "category": "prophets", "duration": 6},
    # History
    {"id": "history-30", "name": "OT Historical Books in 30 Days", "description": "Read Joshua through Esther in one month", "category": "history", "duration": 30},
    {"id": "joshua-6", "name": "Joshua in 6 Days", "description": "Read Joshua in 6 days", "category": "history", "duration": 6},
    {"id": "judges-5", "name": "Judges in 5 Days", "description": "Read Judges in 5 days", "category": "history", "duration": 5},
    {"id": "samuel-8", "name": "1 & 2 Samuel in 8 Days", "description": "Read 1 and 2 Samuel in 8 days", "category": "history", "duration": 8},
    {"id": "kings-9", "name": "1 & 2 Kings in 9 Days", "description": "Read 1 and 2 Kings in 9 days", "category": "history", "duration": 9},
    {"id": "chronicles-9", "name": "1 & 2 Chronicles in 9 Days", "description": "Read 1 and 2 Chronicles in 9 days", "category": "history", "duration": 9},
    # Epistles
    {"id": "paul-14", "name": "Paul's Letters in 14 Days", "description": "Read Romans through Philemon in two weeks", "category": "epistles", "duration": 14},
    {"id": "paul-7", "name": "Paul's Letters in 7 Days", "description": "Read all 13 Pauline epistles in one week", "category": "epistles", "duration": 7},
    {"id": "romans-4", "name": "Romans in 4 Days", "description": "Read Romans in 4 days (~4 chapters/day)", "category": "epistles", "duration": 4},
    {"id": "corinthians-4", "name": "1 & 2 Corinthians in 4 Days", "description": "Read both Corinthian letters in 4 days", "category": "epistles", "duration": 4},
    {"id": "galatians-ephesians-3", "name": "Galatians & Ephesians in 3 Days", "description": "Read Galatians and Ephesians in 3 days", "category": "epistles", "duration": 3},
    {"id": "hebrews-4", "name": "Hebrews in 4 Days", "description": "Read Hebrews in 4 days (~3 chapters/day)", "category": "epistles", "duration": 4},
    {"id": "general-epistles-5", "name": "General Epistles in 5 Days", "description": "Read James through Jude in 5 days", "category": "epistles", "duration": 5},
    {"id": "james-1", "name": "James in 1 Day", "description": "Read the entire book of James in one sitting", "category": "epistles", "duration": 1},
    {"id": "peter-2", "name": "1 & 2 Peter in 2 Days", "description": "Read both Peter letters in 2 days", "category": "epistles", "duration": 2},
    {"id": "john-epistles-2", "name": "1, 2 & 3 John in 2 Days", "description": "Read all three Johannine epistles in 2 days", "category": "epistles", "duration": 2},
    # Thematic plans
    {"id": "christ-ot-21", "name": "Christ in the Old Testament (21 Days)", "description": "Key OT passages that point to Jesus", "category": "thematic", "duration": 21},
    {"id": "prayers-14", "name": "Bible Prayers in 14 Days", "description": "Every major prayer recorded in Scripture", "category": "thematic", "duration": 14},
    {"id": "miracles-10", "name": "Miracles of Jesus in 10 Days", "description": "All recorded miracles of Jesus across the Gospels", "category": "thematic", "duration": 10},
    {"id": "parables-7", "name": "Parables of Jesus in 7 Days", "description": "All parables of Jesus organized by Gospel", "category": "thematic", "duration": 7},
    {"id": "promises-30", "name": "God's Promises in 30 Days", "description": "Key promises from every section of Scripture", "category": "thematic", "duration": 30},
    {"id": "creation-7", "name": "Creation & New Creation in 7 Days", "description": "From Genesis 1 to Revelation 21", "category": "thematic", "duration": 7},
    {"id": "david-14", "name": "Life of David in 14 Days", "description": "Follow David's life from shepherd to king", "category": "thematic", "duration": 14},
    {"id": "paul-21", "name": "Life of Paul in 21 Days", "description": "Follow Paul's journey from Acts 9 onward", "category": "thematic", "duration": 21},
    {"id": "exodus-story-10", "name": "The Exodus Story in 10 Days", "description": "From bondage in Egypt to the Red Sea", "category": "thematic", "duration": 10},
    {"id": "armor-3", "name": "Armor of God in 3 Days", "description": "Spiritual warfare passages across Scripture", "category": "thematic", "duration": 3},
    {"id": "beatitudes-3", "name": "Sermon on the Mount in 3 Days", "description": "Matthew 5-7 in three sittings", "category": "thematic", "duration": 3},
    {"id": "fruit-3", "name": "Fruit of the Spirit in 3 Days", "description": "Galatians 5 and related passages on spiritual fruit", "category": "thematic", "duration": 3},
    {"id": "love-7", "name": "Love Chapter & More in 7 Days", "description": "1 Corinthians 13 and the Bible's greatest love passages", "category": "thematic", "duration": 7},
    {"id": "comfort-14", "name": "Verses of Comfort in 14 Days", "description": "Scripture's most comforting passages for difficult times", "category": "thematic", "duration": 14},
    {"id": "hope-10", "name": "Verses of Hope in 10 Days", "description": "Passages about hope throughout the Bible", "category": "thematic", "duration": 10},
    {"id": "faith-7", "name": "Hall of Faith in 7 Days", "description": "Hebrews 11 and the lives of faith it describes", "category": "thematic", "duration": 7},
    {"id": "resurrection-7", "name": "Resurrection Accounts in 7 Days", "description": "All four Gospel resurrection narratives and 1 Cor 15", "category": "thematic", "duration": 7},
    {"id": "psalms-praise-7", "name": "Psalms of Praise in 7 Days", "description": "The most celebratory psalms (Psalms 95-100, 111-118, 145-150)", "category": "thematic", "duration": 7},
    {"id": "psalms-lament-7", "name": "Psalms of Lament in 7 Days", "description": "The most honest cries to God (Psalms 13, 22, 42, 88, 137)", "category": "thematic", "duration": 7},
    {"id": "messianic-14", "name": "Messianic Prophecies in 14 Days", "description": "OT prophecies about the Messiah and their NT fulfillment", "category": "thematic", "duration": 14},
    {"id": "covenant-7", "name": "Biblical Covenants in 7 Days", "description": "Noahic, Abrahamic, Mosaic, Davidic, New Covenant", "category": "thematic", "duration": 7},
    {"id": "kings-14", "name": "Kings of Israel & Judah in 14 Days", "description": "1 & 2 Kings and 1 & 2 Chronicles overview", "category": "thematic", "duration": 14},
    {"id": "acts-14", "name": "Acts of the Apostles in 14 Days", "description": "The birth and spread of the early church", "category": "history", "duration": 14},
    {"id": "revelation-7", "name": "Revelation in 7 Days", "description": "Read Revelation in one week (~3 chapters/day)", "category": "prophets", "duration": 7},
    {"id": "apocalyptic-10", "name": "Apocalyptic Literature in 10 Days", "description": "Daniel, Ezekiel, Zechariah, and Revelation", "category": "prophets", "duration": 10},
    {"id": "law-15", "name": "The Law (Torah) in 15 Days", "description": "Exodus 19-40, Leviticus, Numbers, Deuteronomy", "category": "pentateuch", "duration": 15},
    {"id": "tabernacle-5", "name": "Tabernacle & Temple in 5 Days", "description": "Exodus 25-40, 1 Kings 6-8, Ezekiel 40-48", "category": "thematic", "duration": 5},
    {"id": "psalms-proverbs", "name": "Psalms & Proverbs Monthly", "description": "Read through Psalms and Proverbs each month", "category": "wisdom", "duration": 31},
    {"id": "chronological", "name": "Chronological Bible", "description": "Read the Bible in chronological order over 1 year", "category": "complete", "duration": 365},
    {"id": "mccheyne", "name": "M'Cheyne Bible Reading Plan", "description": "Read the Bible in a year with 4 portions daily", "category": "complete", "duration": 365},
    {"id": "nt-ot-parallel-365", "name": "NT + OT Parallel in 365 Days", "description": "Read NT and OT portions daily throughout the year", "category": "complete", "duration": 365},
    {"id": "gospels-daily-365", "name": "Daily Gospels in 365 Days", "description": "Read a portion of the Gospels every day for a year", "category": "gospels", "duration": 365},
    {"id": "psalms-twice-60", "name": "Psalms Twice in 60 Days", "description": "Read through all 150 Psalms twice in 60 days", "category": "wisdom", "duration": 60},
    {"id": "proverbs-daily-31", "name": "Daily Proverbs (31 Days)", "description": "One chapter of Proverbs per day — wisdom for each day of the month", "category": "wisdom", "duration": 31},
    {"id": "job-7", "name": "Job in 7 Days", "description": "Read Job in one week (~6 chapters/day)", "category": "wisdom", "duration": 7},
    {"id": "ruth-esther-3", "name": "Ruth & Esther in 3 Days", "description": "Two books about courageous women of faith", "category": "history", "duration": 3},
    {"id": "jonah-obadiah-1", "name": "Jonah & Obadiah in 1 Day", "description": "Two short prophetic books in one sitting", "category": "prophets", "duration": 1},
    {"id": "haggai-zechariah-5", "name": "Haggai & Zechariah in 5 Days", "description": "Post-exilic prophetic encouragement", "category": "prophets", "duration": 5},
    {"id": "philippians-colossians-2", "name": "Philippians & Colossians in 2 Days", "description": "Two joyful prison epistles", "category": "epistles", "duration": 2},
    {"id": "thessalonians-2", "name": "1 & 2 Thessalonians in 2 Days", "description": "Paul's letters on Christ's return", "category": "epistles", "duration": 2},
    {"id": "timothy-titus-3", "name": "1 & 2 Timothy, Titus in 3 Days", "description": "Paul's pastoral letters on church leadership", "category": "epistles", "duration": 3},
    {"id": "jude-1", "name": "Jude in 1 Day", "description": "Read Jude's urgent letter in one sitting", "category": "epistles", "duration": 1},
    {"id": "genesis-25", "name": "Genesis in 25 Days", "description": "Read Genesis in 25 days (~2 chapters/day)", "category": "pentateuch", "duration": 25},
    {"id": "deuteronomy-7", "name": "Deuteronomy in 7 Days", "description": "Read Moses' farewell speeches in one week", "category": "pentateuch", "duration": 7},
    {"id": "ezra-nehemiah-5", "name": "Ezra & Nehemiah in 5 Days", "description": "Return from exile and rebuilding Jerusalem", "category": "history", "duration": 5},
    {"id": "lamentations-1", "name": "Lamentations in 1 Day", "description": "Read all five chapters of Lamentations in one sitting", "category": "prophets", "duration": 1},
    {"id": "hosea-joel-amos-4", "name": "Hosea, Joel & Amos in 4 Days", "description": "Three prophets of Israel's turning", "category": "prophets", "duration": 4},
    {"id": "micah-nahum-habakkuk-3", "name": "Micah, Nahum & Habakkuk in 3 Days", "description": "Three prophets of justice and judgment", "category": "prophets", "duration": 3},
    {"id": "zephaniah-malachi-3", "name": "Zephaniah & Malachi in 3 Days", "description": "Day of the Lord and final OT prophetic voice", "category": "prophets", "duration": 3},
]

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
    return {"plans": BUILTIN_PLAN_TEMPLATES, "count": len(BUILTIN_PLAN_TEMPLATES)}


@router.get("")
async def list_plans(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(ReadingPlan)
        .where(ReadingPlan.user_id == user.id)
        .order_by(ReadingPlan.created_at.desc())
    )
    plans = result.scalars().all()
    return {
        "plans": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "plan_type": p.plan_type,
                "goal": p.goal,
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
async def start_plan(
    body: PlanStart,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if body.plan_type not in BUILT_IN_PLANS:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan_type}")

    start_date = body.start_date or str(date.today())
    plan_def = BUILT_IN_PLANS[body.plan_type]

    plan = ReadingPlan(
        user_id=user.id,
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
async def delete_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    await db.execute(
        delete(ReadingPlan).where(ReadingPlan.id == plan_id, ReadingPlan.user_id == user.id)
    )
    await db.commit()
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────
# AI-generated plan persistence
# ──────────────────────────────────────────────────────────────────

class StartAiPlanRequest(BaseModel):
    plan_name: str
    goal: str = ""
    days: list
    start_date: Optional[str] = None


@router.post("/start-ai")
async def start_ai_plan(
    body: StartAiPlanRequest,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Persist an AI-generated reading plan to the database."""
    start_date = body.start_date or str(date.today())

    plan = ReadingPlan(
        user_id=user.id,
        name=body.plan_name,
        goal=body.goal,
        start_date=start_date,
        plan_type="ai-generated",
        description=f"AI-generated plan: {body.goal}",
    )
    db.add(plan)
    await db.flush()

    start = date.fromisoformat(start_date)
    for day_entry in body.days:
        day_num = day_entry.get("day", 1)
        day_date = str(start + timedelta(days=day_num - 1))
        day_label = day_entry.get("day_label", f"Day {day_num}")
        desc = day_entry.get("description", "")
        for ref in day_entry.get("passages", []):
            db.add(ReadingPlanDay(
                plan_id=plan.id,
                date=day_date,
                reference=ref,
                day_label=day_label,
                description=desc,
            ))

    await db.commit()
    await db.refresh(plan)
    return {"id": plan.id, "name": plan.name, "start_date": plan.start_date}


# ──────────────────────────────────────────────────────────────────
# Detailed plan view
# ──────────────────────────────────────────────────────────────────

@router.get("/{plan_id}")
async def get_plan_detail(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Get full plan with all days and progress."""
    plan_result = await db.execute(
        select(ReadingPlan).where(ReadingPlan.id == plan_id, ReadingPlan.user_id == user.id)
    )
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Fetch all days
    days_result = await db.execute(
        select(ReadingPlanDay)
        .where(ReadingPlanDay.plan_id == plan_id)
        .order_by(ReadingPlanDay.date, ReadingPlanDay.id)
    )
    days = days_result.scalars().all()

    # Fetch all progress
    progress_result = await db.execute(
        select(ReadingPlanProgress).where(ReadingPlanProgress.plan_id == plan_id)
    )
    progress_rows = progress_result.scalars().all()
    completed_set = {
        (p.date, p.reference)
        for p in progress_rows
        if p.completed_at is not None
    }

    # Group days by date
    days_by_date: dict = {}
    for d in days:
        entry = days_by_date.setdefault(d.date, {
            "date": d.date,
            "day_label": d.day_label,
            "description": d.description,
            "passages": [],
            "completed_count": 0,
            "total_count": 0,
        })
        entry["passages"].append({
            "reference": d.reference,
            "completed": (d.date, d.reference) in completed_set,
        })
        entry["total_count"] += 1
        if (d.date, d.reference) in completed_set:
            entry["completed_count"] += 1

    total_passages = sum(e["total_count"] for e in days_by_date.values())
    completed_passages = sum(e["completed_count"] for e in days_by_date.values())

    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "plan_type": plan.plan_type,
        "goal": plan.goal,
        "start_date": plan.start_date,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "progress": {
            "total_passages": total_passages,
            "completed_passages": completed_passages,
            "percent": round(completed_passages / total_passages * 100) if total_passages > 0 else 0,
        },
        "days": [days_by_date[k] for k in sorted(days_by_date.keys())],
    }


@router.get("/today")
async def get_today(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    today = str(date.today())

    # All entries for today across every plan belonging to this user, in one query.
    days_rows = await db.execute(
        select(ReadingPlanDay, ReadingPlan.name)
        .join(ReadingPlan, ReadingPlanDay.plan_id == ReadingPlan.id)
        .where(ReadingPlanDay.date == today, ReadingPlan.user_id == user.id)
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
    # Toggle behavior: check current state first, then either set or clear.
    existing = await db.execute(
        select(ReadingPlanProgress).where(
            ReadingPlanProgress.plan_id == plan_id,
            ReadingPlanProgress.date == today,
            ReadingPlanProgress.reference == reference,
        )
    )
    row = existing.scalar_one_or_none()

    if row is None:
        # Not yet recorded — mark complete.
        db.add(ReadingPlanProgress(
            plan_id=plan_id, date=today, reference=reference,
            completed_at=datetime.utcnow(),
        ))
        completed = True
    elif row.completed_at is not None:
        # Already completed → toggle back to incomplete.
        row.completed_at = None
        completed = False
    else:
        # Recorded but not completed → mark complete.
        row.completed_at = datetime.utcnow()
        completed = True

    await db.commit()
    return {"completed": completed}


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
