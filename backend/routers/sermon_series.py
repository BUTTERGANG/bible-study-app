"""Preaching series — plan and track multi-sermon series over a date range.

Endpoints:
  POST   /api/sermon-series               — create a series
  GET    /api/sermon-series               — list user's series
  GET    /api/sermon-series/{id}          — get series with entries
  PUT    /api/sermon-series/{id}          — update series metadata
  DELETE /api/sermon-series/{id}          — delete series and entries

  POST   /api/sermon-series/{id}/entries  — add an entry (sermon slot)
  PUT    /api/sermon-series/{id}/entries/{entry_id}   — update entry status/sermon
  DELETE /api/sermon-series/{id}/entries/{entry_id}   — remove entry
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import SermonProject, SermonSeries, SermonSeriesEntry

router = APIRouter(prefix="/api/sermon-series", tags=["sermon-series"])


# ── Schemas ─────────────────────────────────────────────────────────────


class SeriesCreate(BaseModel):
    title: str
    theme: str | None = None
    start_date: str   # ISO date e.g. "2026-09-07"
    end_date: str


class SeriesUpdate(BaseModel):
    title: str | None = None
    theme: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class EntryCreate(BaseModel):
    scheduled_date: str   # ISO date
    sermon_id: int | None = None
    status: str = "planned"
    notes: str | None = None


class EntryUpdate(BaseModel):
    sermon_id: int | None = None
    status: str | None = None
    notes: str | None = None
    scheduled_date: str | None = None


# ── Helpers ─────────────────────────────────────────────────────────────


def _entry_dict(e: SermonSeriesEntry) -> dict:
    sermon_title = None
    if e.sermon:
        sermon_title = e.sermon.title
    return {
        "id": e.id,
        "series_id": e.series_id,
        "sermon_id": e.sermon_id,
        "sermon_title": sermon_title,
        "scheduled_date": e.scheduled_date,
        "status": e.status,
        "notes": e.notes,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


def _series_dict(s: SermonSeries, entries: list[SermonSeriesEntry] | None = None) -> dict:
    d = {
        "id": s.id,
        "user_id": s.user_id,
        "title": s.title,
        "theme": s.theme,
        "start_date": s.start_date,
        "end_date": s.end_date,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }
    if entries is not None:
        d["entries"] = [_entry_dict(e) for e in entries]
        d["entry_count"] = len(entries)
        d["planned"] = sum(1 for e in entries if e.status == "planned")
        d["drafted"] = sum(1 for e in entries if e.status == "drafted")
        d["preached"] = sum(1 for e in entries if e.status == "preached")
    return d


# ── Series CRUD ──────────────────────────────────────────────────────────


@router.post("")
async def create_series(
    body: SeriesCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    series = SermonSeries(
        user_id=user.id,
        title=body.title.strip(),
        theme=body.theme,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    db.add(series)
    await db.commit()
    await db.refresh(series)
    return _series_dict(series, entries=[])


@router.get("")
async def list_series(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SermonSeries)
        .where(SermonSeries.user_id == user.id)
        .order_by(SermonSeries.start_date.desc())
    )
    series_list = result.scalars().all()

    # Batch entry counts
    series_ids = [s.id for s in series_list]
    entries_map: dict[int, list] = {s.id: [] for s in series_list}
    if series_ids:
        entries_q = await db.execute(
            select(SermonSeriesEntry)
            .where(SermonSeriesEntry.series_id.in_(series_ids))
            .order_by(SermonSeriesEntry.scheduled_date)
        )
        for entry in entries_q.scalars().all():
            entries_map[entry.series_id].append(entry)

    return {
        "series": [_series_dict(s, entries=entries_map[s.id]) for s in series_list]
    }


@router.get("/{series_id}")
async def get_series(
    series_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SermonSeries).where(
            SermonSeries.id == series_id,
            SermonSeries.user_id == user.id,
        )
    )
    series = result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    entries_q = await db.execute(
        select(SermonSeriesEntry)
        .where(SermonSeriesEntry.series_id == series_id)
        .order_by(SermonSeriesEntry.scheduled_date)
    )
    entries = list(entries_q.scalars().all())

    # Eager-load sermon titles via a batch query
    sermon_ids = [e.sermon_id for e in entries if e.sermon_id is not None]
    sermon_map: dict[int, SermonProject] = {}
    if sermon_ids:
        sermons_q = await db.execute(
            select(SermonProject).where(SermonProject.id.in_(sermon_ids))
        )
        sermon_map = {s.id: s for s in sermons_q.scalars().all()}
    for entry in entries:
        if entry.sermon_id and entry.sermon_id in sermon_map:
            entry.sermon = sermon_map[entry.sermon_id]

    return _series_dict(series, entries=entries)


@router.put("/{series_id}")
async def update_series(
    series_id: int,
    body: SeriesUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SermonSeries).where(
            SermonSeries.id == series_id,
            SermonSeries.user_id == user.id,
        )
    )
    series = result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    if body.title is not None:
        series.title = body.title.strip()
    if body.theme is not None:
        series.theme = body.theme
    if body.start_date is not None:
        series.start_date = body.start_date
    if body.end_date is not None:
        series.end_date = body.end_date
    series.updated_at = datetime.now(UTC)
    await db.commit()
    return _series_dict(series)


@router.delete("/{series_id}")
async def delete_series(
    series_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SermonSeries).where(
            SermonSeries.id == series_id,
            SermonSeries.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Series not found")
    await db.execute(delete(SermonSeries).where(SermonSeries.id == series_id))
    await db.commit()
    return {"deleted": True}


# ── Entry CRUD ─────────────────────────────────────────────────────────


@router.post("/{series_id}/entries")
async def add_entry(
    series_id: int,
    body: EntryCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    series_q = await db.execute(
        select(SermonSeries).where(
            SermonSeries.id == series_id,
            SermonSeries.user_id == user.id,
        )
    )
    if not series_q.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Series not found")

    if body.status not in ("planned", "drafted", "preached"):
        raise HTTPException(status_code=400, detail="status must be planned, drafted, or preached")

    entry = SermonSeriesEntry(
        series_id=series_id,
        sermon_id=body.sermon_id,
        scheduled_date=body.scheduled_date,
        status=body.status,
        notes=body.notes,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _entry_dict(entry)


@router.put("/{series_id}/entries/{entry_id}")
async def update_entry(
    series_id: int,
    entry_id: int,
    body: EntryUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify series ownership
    series_q = await db.execute(
        select(SermonSeries).where(
            SermonSeries.id == series_id,
            SermonSeries.user_id == user.id,
        )
    )
    if not series_q.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Series not found")

    entry_q = await db.execute(
        select(SermonSeriesEntry).where(
            SermonSeriesEntry.id == entry_id,
            SermonSeriesEntry.series_id == series_id,
        )
    )
    entry = entry_q.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if body.sermon_id is not None:
        entry.sermon_id = body.sermon_id
    if body.status is not None:
        if body.status not in ("planned", "drafted", "preached"):
            raise HTTPException(status_code=400, detail="status must be planned, drafted, or preached")
        entry.status = body.status
    if body.notes is not None:
        entry.notes = body.notes
    if body.scheduled_date is not None:
        entry.scheduled_date = body.scheduled_date
    entry.updated_at = datetime.now(UTC)
    await db.commit()
    return _entry_dict(entry)


@router.delete("/{series_id}/entries/{entry_id}")
async def delete_entry(
    series_id: int,
    entry_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    series_q = await db.execute(
        select(SermonSeries).where(
            SermonSeries.id == series_id,
            SermonSeries.user_id == user.id,
        )
    )
    if not series_q.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Series not found")

    result = await db.execute(
        delete(SermonSeriesEntry).where(
            SermonSeriesEntry.id == entry_id,
            SermonSeriesEntry.series_id == series_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"deleted": True}
