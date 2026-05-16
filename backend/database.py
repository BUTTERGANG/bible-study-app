"""SQLAlchemy async engine + session factory and DB-presence introspection.

The Bible content database is bulk-loaded ahead of time (~2.24 GB). The app
must not silently appear to work when that file is missing — `db_status()` is
used by lifespan and /api/health to surface the situation clearly.
"""

import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

_BACKEND_DIR = Path(__file__).parent

DATA_PATH = Path(os.getenv("DATA_PATH", _BACKEND_DIR.parent / "data"))
DB_PATH = DATA_PATH / "bible.db"

engine = create_async_engine(f"sqlite+aiosqlite:///{DB_PATH}", echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with SessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def db_status() -> dict:
    """Snapshot of database readiness — used by /api/health and the startup
    banner. Reports file presence, verse count, and which FTS tables are
    available. Never raises — every field has a stable fallback."""
    status = {
        "db_file_exists": DB_PATH.exists(),
        "db_path": str(DB_PATH),
        "verses": 0,
        "fts_bible": False,
        "fts_commentary": False,
        "ok": False,
    }
    if not status["db_file_exists"]:
        return status
    try:
        from sqlalchemy import text
        async with SessionLocal() as session:
            verses = await session.execute(
                text("SELECT COUNT(*) FROM bible_verses")
            )
            status["verses"] = int(verses.scalar() or 0)
            for name, key in (
                ("bible_verses_fts", "fts_bible"),
                ("commentary_fts", "fts_commentary"),
            ):
                row = await session.execute(
                    text(
                        "SELECT name FROM sqlite_master "
                        "WHERE type IN ('table','virtual') AND name = :n"
                    ),
                    {"n": name},
                )
                status[key] = row.scalar_one_or_none() is not None
        status["ok"] = status["verses"] > 0
    except Exception as e:
        status["error"] = str(e)
    return status
