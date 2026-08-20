#!/usr/bin/env python3
"""
Extract text from PDF library files and register in SQLite.
Optionally builds ChromaDB vector index for semantic search.

Usage:
    cd /Volumes/T5 EVO/REPLIT/LOGOS-COPYCAT/app
    python ingest/ingest_pdfs.py
    python ingest/ingest_pdfs.py --chroma  # also build vector index
"""

import argparse
import os
import sqlite3
import sys
from pathlib import Path

APP_DIR = Path(__file__).parent.parent
LIBRARY_DIR = Path(os.getenv("LIBRARY_PATH", APP_DIR.parent / "library"))
DATA_DIR = Path(os.getenv("DATA_PATH", APP_DIR / "data"))
DB_PATH = DATA_DIR / "bible.db"

PDF_CATEGORIES = [
    ("commentaries", "Commentary"),
    ("ccel/commentaries", "Commentary"),
    ("ccel/devotional", "Devotional"),
    ("ccel/theology", "Theology"),
    ("ccel/church_history", "Church History"),
    ("study_bibles", "Study Bible"),
    ("book_notes", "Book Notes"),
    ("gutenberg/commentaries", "Commentary"),
    ("gutenberg/theology", "Theology"),
    ("gutenberg/lexicons", "Lexicons"),
]


def extract_pdf_pages(pdf_path: Path):
    """Yield (page_num, text) for each page of a PDF."""
    try:
        import fitz
        doc = fitz.open(str(pdf_path))
        for page_num in range(doc.page_count):
            text = doc[page_num].get_text()
            if text.strip():
                yield page_num + 1, text
        doc.close()
    except Exception as e:
        print(f"    Error reading {pdf_path.name}: {e}")


def update_library_registrations(conn: sqlite3.Connection):
    """Register/update all PDF files in library_books."""
    try:
        import fitz
    except ImportError:
        print("PyMuPDF not installed — skipping page count")
        fitz = None

    count = 0
    for rel_path, category in PDF_CATEGORIES:
        cat_dir = LIBRARY_DIR / rel_path
        if not cat_dir.exists():
            continue
        for pdf_path in sorted(cat_dir.glob("*.pdf")):
            existing = conn.execute(
                "SELECT id FROM library_books WHERE source_path = ?", (str(pdf_path),)
            ).fetchone()
            if existing:
                continue

            title = pdf_path.stem.replace("_", " ")
            author = _extract_author(title)
            page_count = None
            if fitz:
                try:
                    doc = fitz.open(str(pdf_path))
                    page_count = doc.page_count
                    doc.close()
                except Exception:
                    pass

            conn.execute(
                "INSERT INTO library_books (title, author, category, source_format, source_path, page_count) "
                "VALUES (?, ?, ?, 'pdf', ?, ?)",
                (title, author, category, str(pdf_path), page_count),
            )
            count += 1

    conn.commit()
    print(f"Registered {count} new PDF files.")


def build_chroma_index(conn: sqlite3.Connection):
    """Build ChromaDB vector index from PDF text and Bible verses."""
    try:
        import chromadb
    except ImportError:
        print("chromadb not installed — skipping vector index")
        return

    chroma_path = DATA_DIR / "chroma"
    chroma_path.mkdir(exist_ok=True)

    client = chromadb.PersistentClient(path=str(chroma_path))

    # Index Bible verses (KJV only for now to keep size manageable)
    print("Building verse vector index (KJV)...")
    verses_col = client.get_or_create_collection(
        "bible_verses",
        metadata={"hnsw:space": "cosine"},
    )

    rows = conn.execute(
        "SELECT id, book, chapter, verse, text FROM bible_verses WHERE translation='KJV' LIMIT 31102"
    ).fetchall()

    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        ids = [f"kjv_{r[0]}" for r in batch]
        docs = [r[4] for r in batch]
        metas = [{"book": r[1], "chapter": r[2], "verse": r[3], "translation": "KJV"} for r in batch]
        try:
            verses_col.add(ids=ids, documents=docs, metadatas=metas)
        except Exception:
            pass  # Skip duplicates

    print(f"  Indexed {len(rows)} KJV verses")

    # Index commentary entries (sample)
    print("Building commentary vector index...")
    comm_col = client.get_or_create_collection(
        "commentaries",
        metadata={"hnsw:space": "cosine"},
    )

    entries = conn.execute(
        "SELECT id, source, book, chapter, verse_start, text FROM commentary_entries "
        "WHERE length(text) > 100 LIMIT 5000"
    ).fetchall()

    for i in range(0, len(entries), batch_size):
        batch = entries[i:i + batch_size]
        ids = [f"comm_{r[0]}" for r in batch]
        docs = [r[5][:1000] for r in batch]
        metas = [{"source": r[1], "book": r[2], "chapter": r[3], "verse": r[4]} for r in batch]
        try:
            comm_col.add(ids=ids, documents=docs, metadatas=metas)
        except Exception:
            pass

    print(f"  Indexed {len(entries)} commentary entries")


def _extract_author(title: str) -> str:
    known = {
        "Calvin": "John Calvin", "Spurgeon": "C.H. Spurgeon",
        "Matthew Henry": "Matthew Henry", "JFB": "Jamieson, Fausset & Brown",
        "Barnes": "Albert Barnes", "Wesley": "John Wesley",
        "Clarke": "Adam Clarke", "Schaff": "Philip Schaff",
        "Luther": "Martin Luther", "Lightfoot": "J.B. Lightfoot",
        "Strong": "A.H. Strong", "Maclaren": "Alexander Maclaren",
    }
    for key, author in known.items():
        if key in title:
            return author
    return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chroma", action="store_true", help="Build ChromaDB vector index")
    args = parser.parse_args()

    print("=== PDF Library Ingestion ===\n")

    if not DB_PATH.exists():
        print(f"ERROR: {DB_PATH} not found. Run ingest_sword.py first.")
        sys.exit(1)

    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")

    print("Registering PDF files...")
    update_library_registrations(conn)

    if args.chroma:
        print("\nBuilding vector indexes...")
        build_chroma_index(conn)

    conn.close()
    print("\n=== DONE ===")


if __name__ == "__main__":
    main()
