"""Lectionary — Revised Common Lectionary (RCL) readings.

GET /api/lectionary/today          — today's readings
GET /api/lectionary/{date}         — readings for a specific date (YYYY-MM-DD)
"""
import json
import logging
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException

logger = logging.getLogger("bible-study.lectionary")
router = APIRouter(prefix="/api/lectionary", tags=["lectionary"])

# ── Load lectionary data from static JSON ────────────────────────────────────
_LECTIONARY_PATH = Path(__file__).parent.parent / "data" / "lectionary_year_a.json"
_LECTIONARY_DATA = None


def _load_lectionary():
    global _LECTIONARY_DATA
    if _LECTIONARY_DATA is not None:
        return _LECTIONARY_DATA
    try:
        with open(_LECTIONARY_PATH, encoding="utf-8") as f:
            _LECTIONARY_DATA = json.load(f)
    except FileNotFoundError:
        logger.error("lectionary_year_a.json not found at %s", _LECTIONARY_PATH)
        _LECTIONARY_DATA = {"readings": []}
    return _LECTIONARY_DATA


def _find_reading(target_date: str):
    """Find the reading for a given date string (YYYY-MM-DD)."""
    data = _load_lectionary()
    for reading in data.get("readings", []):
        if reading["date"] == target_date:
            return reading
    return None


def _find_nearest_reading(target_date: str):
    """Find the nearest reading to the given date, in either direction."""
    data = _load_lectionary()
    target = datetime.strptime(target_date, "%Y-%m-%d")
    best = None
    best_diff = None
    for reading in data.get("readings", []):
        r_date = datetime.strptime(reading["date"], "%Y-%m-%d")
        diff = abs((r_date - target).days)
        if best_diff is None or diff < best_diff:
            best = reading
            best_diff = diff
    return best


def _adjacent_dates(matched_date: str):
    """Return the previous and next lectionary dates relative to matched_date."""
    data = _load_lectionary()
    dates = sorted(r["date"] for r in data.get("readings", []))
    if matched_date not in dates:
        return None, None
    idx = dates.index(matched_date)
    prev_date = dates[idx - 1] if idx > 0 else None
    next_date = dates[idx + 1] if idx < len(dates) - 1 else None
    return prev_date, next_date


@router.get("/today")
async def get_today_readings():
    """Return today's lectionary readings."""
    today_str = date.today().isoformat()
    reading = _find_reading(today_str)
    if not reading:
        # Fall back to nearest past reading
        reading = _find_nearest_reading(today_str)
    if not reading:
        return {
            "date": today_str,
            "season": "Ordinary Time",
            "sunday_name": None,
            "year_cycle": "A",
            "readings": [],
            "note": "No lectionary data for today. Showing nearest available.",
        }
    return {
        "date": today_str,
        "matched_date": reading["date"],
        "season": reading["season"],
        "season_color": reading.get("season_color", "#22c55e"),
        "sunday_name": reading.get("sunday_name"),
        "year_cycle": reading.get("year_cycle", "A"),
        "readings": reading["readings"],
    }


@router.get("/{date}")
async def get_readings_by_date(date: str):
    """Return lectionary readings for a specific date (YYYY-MM-DD)."""
    # Validate date format
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.") from None

    reading = _find_reading(date)
    if not reading:
        reading = _find_nearest_reading(date)
    if not reading:
        return {
            "date": date,
            "matched_date": None,
            "season": "Ordinary Time",
            "sunday_name": None,
            "year_cycle": "A",
            "readings": [],
            "prev_date": None,
            "next_date": None,
        }

    prev_date, next_date = _adjacent_dates(reading["date"])
    return {
        "date": date,
        "matched_date": reading["date"],
        "season": reading["season"],
        "season_color": reading.get("season_color", "#22c55e"),
        "sunday_name": reading.get("sunday_name"),
        "year_cycle": reading.get("year_cycle", "A"),
        "readings": reading["readings"],
        "prev_date": prev_date,
        "next_date": next_date,
    }
