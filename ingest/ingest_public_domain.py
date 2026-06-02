#!/usr/bin/env python3
"""
Fetch public-domain theological texts from Project Gutenberg and
insert them as LibraryBook + LibraryPage records so the library
works without requiring local PDFs.

Run from the workspace root:
    python3 ingest/ingest_public_domain.py
"""

import asyncio
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env", override=False)

from backend.database import init_db, SessionLocal
from backend.models import LibraryBook, LibraryPage

# ---------------------------------------------------------------------------
# Texts to ingest — all public domain from Project Gutenberg
# ---------------------------------------------------------------------------
TEXTS = [
    {
        "pg_id": 3296,
        "title": "Confessions of St. Augustine",
        "author": "Augustine of Hippo",
        "category": "Theology",
    },
    {
        "pg_id": 3492,
        "title": "The City of God",
        "author": "Augustine of Hippo",
        "category": "Theology",
    },
    {
        "pg_id": 38452,
        "title": "Institutes of the Christian Religion Vol. I",
        "author": "John Calvin",
        "category": "Theology",
    },
    {
        "pg_id": 45001,
        "title": "Institutes of the Christian Religion Vol. II",
        "author": "John Calvin",
        "category": "Theology",
    },
    {
        "pg_id": 3392,
        "title": "History of the Christian Church Vol. I",
        "author": "Philip Schaff",
        "category": "Church History",
    },
    {
        "pg_id": 5245,
        "title": "The Didache (Teaching of the Twelve Apostles)",
        "author": "Early Church",
        "category": "Church History",
    },
    {
        "pg_id": 1404,
        "title": "On the Incarnation",
        "author": "Athanasius",
        "category": "Theology",
    },
    {
        "pg_id": 2849,
        "title": "The Works of Josephus — Antiquities",
        "author": "Flavius Josephus",
        "category": "Church History",
    },
    {
        "pg_id": 9295,
        "title": "Morning and Evening Devotions",
        "author": "Charles H. Spurgeon",
        "category": "Devotional",
    },
    {
        "pg_id": 6121,
        "title": "All of Grace",
        "author": "Charles H. Spurgeon",
        "category": "Devotional",
    },
]

PAGE_CHARS = 3000   # characters per "page"
HEADERS = {"User-Agent": "Mozilla/5.0 BibleStudyApp/1.0"}


def fetch_text(pg_id: int) -> str | None:
    for url in [
        f"https://www.gutenberg.org/cache/epub/{pg_id}/pg{pg_id}.txt",
        f"https://www.gutenberg.org/files/{pg_id}/{pg_id}-0.txt",
        f"https://www.gutenberg.org/files/{pg_id}/{pg_id}.txt",
    ]:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as r:
                raw = r.read().decode("utf-8", errors="replace")
            # Normalise Windows line endings so paragraph splitting works
            raw = raw.replace("\r\n", "\n").replace("\r", "\n")
            print(f"    fetched {len(raw):,} chars from {url}")
            return raw
        except Exception as e:
            print(f"    {url} — {e}")
    return None


def strip_gutenberg_header_footer(text: str) -> str:
    """Remove the PG legal header/footer."""
    start = re.search(
        r"\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG", text, re.IGNORECASE
    )
    end = re.search(
        r"\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG", text, re.IGNORECASE
    )
    if start:
        text = text[start.end():]
    if end:
        text = text[: end.start()]
    return text.strip()


def split_into_pages(text: str, page_size: int = PAGE_CHARS) -> list[str]:
    """Split on paragraph boundaries, targeting page_size characters per page."""
    paragraphs = re.split(r"\n{2,}", text)
    pages, current = [], ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if current and len(current) + len(para) > page_size:
            pages.append(current.strip())
            current = para
        else:
            current = (current + "\n\n" + para).lstrip() if current else para
    if current.strip():
        pages.append(current.strip())
    return pages


async def ingest_book(session, meta: dict) -> int:
    from sqlalchemy import select

    raw = fetch_text(meta["pg_id"])
    if not raw:
        print(f"  SKIP — could not fetch pg{meta['pg_id']}")
        return 0

    body = strip_gutenberg_header_footer(raw)
    pages = split_into_pages(body)
    if not pages:
        print(f"  SKIP — no content after stripping")
        return 0

    # Check if already ingested (by title)
    existing = await session.execute(
        select(LibraryBook).where(LibraryBook.title == meta["title"])
    )
    book = existing.scalar_one_or_none()

    if book is None:
        book = LibraryBook(
            title=meta["title"],
            author=meta["author"],
            category=meta["category"],
            source_format="text",
            source_path="",
            page_count=len(pages),
        )
        session.add(book)
        await session.flush()  # get book.id
    else:
        book.page_count = len(pages)
        # Delete old pages so we can re-insert cleanly
        await session.execute(
            LibraryPage.__table__.delete().where(LibraryPage.book_id == book.id)
        )

    for i, page_text in enumerate(pages, start=1):
        session.add(LibraryPage(book_id=book.id, page_num=i, text=page_text))

    await session.commit()
    print(f"  OK — {len(pages)} pages ingested")
    return len(pages)


async def main():
    await init_db()
    total = 0
    async with SessionLocal() as session:
        for meta in TEXTS:
            print(f"\n{meta['title']} (pg{meta['pg_id']})")
            pages = await ingest_book(session, meta)
            total += pages
    print(f"\nDone — {total} total pages inserted across {len(TEXTS)} books.")


if __name__ == "__main__":
    asyncio.run(main())
