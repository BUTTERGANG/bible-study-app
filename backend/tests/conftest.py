"""Pytest fixtures.

Spins up a fresh on-disk SQLite database per session, seeded with a small,
representative slice of Bible data. The real 2.24 GB content DB is never
touched by tests.
"""

import asyncio
import os
import shutil
import sqlite3
import tempfile
from pathlib import Path

import pytest

# ── Pre-collection setup ──────────────────────────────────────────────────────
# test_auth.py imports backend.auth at module level, which triggers
# backend.database to create its SQLAlchemy engine at import time.  Fixtures
# run *after* collection, so a session-scoped fixture is too late to redirect
# DATA_PATH.  pytest_configure runs before collection and fixes this.

_TEST_DIR: Path | None = None


def pytest_configure(config):
    global _TEST_DIR
    _TEST_DIR = Path(tempfile.mkdtemp(prefix="logos_test_"))
    os.environ["DATA_PATH"] = str(_TEST_DIR)
    os.environ["APP_PASSWORD"] = ""
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret-do-not-use-in-prod-min-32-chars-long")
    _seed_db(_TEST_DIR / "bible.db")


def pytest_unconfigure(config):
    if _TEST_DIR and _TEST_DIR.exists():
        shutil.rmtree(_TEST_DIR, ignore_errors=True)


def _seed_db(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE bible_verses (
            id INTEGER PRIMARY KEY,
            translation TEXT,
            book TEXT,
            book_num INTEGER,
            chapter INTEGER,
            verse INTEGER,
            text TEXT
        );
        CREATE TABLE commentary_entries (
            id INTEGER PRIMARY KEY,
            source TEXT,
            book TEXT,
            chapter INTEGER,
            verse_start INTEGER,
            verse_end INTEGER,
            text TEXT
        );
        CREATE VIRTUAL TABLE bible_verses_fts USING fts5(text, content='bible_verses', content_rowid='id');
        CREATE VIRTUAL TABLE commentary_fts USING fts5(text, content='commentary_entries', content_rowid='id');
        """
    )
    cur.executemany(
        "INSERT INTO bible_verses (translation, book, book_num, chapter, verse, text) VALUES (?,?,?,?,?,?)",
        [
            ("KJV", "John", 43, 3, 16, "For God so loved the world..."),
            ("KJV", "John", 43, 3, 17, "For God sent not his Son into the world to condemn the world..."),
            ("ASV", "John", 43, 3, 16, "For God so loved the world, that he gave his only begotten Son..."),
            ("KJV", "Genesis", 1, 1, 1, "In the beginning God created the heaven and the earth."),
        ],
    )
    cur.executemany(
        "INSERT INTO commentary_entries (source, book, chapter, verse_start, verse_end, text) VALUES (?,?,?,?,?,?)",
        [
            ("MHC", "John", 3, 16, None, "The love of God in giving His Son for the world."),
            ("JFB", "John", 3, 16, None, "World here means all humanity, not all without exception."),
        ],
    )
    cur.execute("INSERT INTO bible_verses_fts(rowid, text) SELECT id, text FROM bible_verses;")
    cur.execute("INSERT INTO commentary_fts(rowid, text) SELECT id, text FROM commentary_entries;")
    conn.commit()
    conn.close()


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture()
async def client():
    """ASGI test client with lifespan run (so init_db + FTS detection fire)."""
    from asgi_lifespan import LifespanManager
    from httpx import ASGITransport, AsyncClient

    from backend.main import app

    async with LifespanManager(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
