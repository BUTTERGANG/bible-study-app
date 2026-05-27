"""Pytest fixtures.

Spins up a fresh on-disk SQLite database per session, seeded with a small,
representative slice of Bible data. The real 2.24 GB content DB is never
touched by tests.
"""

import asyncio
import os
import tempfile
from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
def _isolated_test_db(tmp_path_factory):
    """Point DATA_PATH at a temp dir before any backend module imports the
    database engine, then seed a few verses + an FTS table so search works."""
    test_data = tmp_path_factory.mktemp("data")
    os.environ["DATA_PATH"] = str(test_data)
    os.environ["APP_PASSWORD"] = ""  # disable auth for tests
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret-do-not-use-in-prod")

    import sqlite3
    db = test_data / "bible.db"
    conn = sqlite3.connect(db)
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
    # A tiny but coherent fixture set: John 3:16-17 (KJV + ASV) + one commentary.
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
    yield


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
