#!/usr/bin/env python3
"""Pre-extract PDF page text into the `library_pages` table.

Runs once per ingest. Lets the production app serve library content without
PyMuPDF (which has been brittle on Replit/Nix). For each `library_books` row
that's a PDF and whose source file exists on disk, this writes one row per
page into `library_pages`.

Usage:
    PYTHONPATH=.venv/lib/python3.11/site-packages \
      python3 -m ingest.extract_pdf_pages [--book-id N] [--force]
"""

import argparse
import os
import sys
import sqlite3
from pathlib import Path

try:
    import fitz  # PyMuPDF
except (ImportError, OSError) as e:
    print(f"PyMuPDF is required to extract pages: {e}", file=sys.stderr)
    sys.exit(1)

REPO = Path(__file__).resolve().parent.parent
DB = Path(os.getenv("DATA_PATH", REPO / "data")) / "bible.db"


def extract(book_id: int | None, force: bool) -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # Ensure the table exists — Alembic creates it on prod, but ingest may run
    # against a fresh dev DB.
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS library_pages (
            id INTEGER PRIMARY KEY,
            book_id INTEGER REFERENCES library_books(id),
            page_num INTEGER,
            text TEXT,
            UNIQUE(book_id, page_num)
        )
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS ix_library_pages_book ON library_pages(book_id)")

    where = ["source_format = 'pdf'"]
    params: list = []
    if book_id is not None:
        where.append("id = ?")
        params.append(book_id)
    cur.execute(
        f"SELECT id, title, source_path, page_count FROM library_books WHERE {' AND '.join(where)}",
        params,
    )
    books = cur.fetchall()
    if not books:
        print("No matching PDF books found.")
        return

    for bid, title, path, pages in books:
        if not path or not os.path.exists(path):
            print(f"  skip [{bid}] {title}: file not on disk")
            continue

        if not force:
            cur.execute("SELECT COUNT(*) FROM library_pages WHERE book_id = ?", (bid,))
            if cur.fetchone()[0] > 0:
                print(f"  skip [{bid}] {title}: already extracted (use --force)")
                continue

        print(f"  extract [{bid}] {title} ({pages} pages)")
        try:
            pdf = fitz.open(path)
        except Exception as e:
            print(f"    error opening: {e}")
            continue

        cur.execute("DELETE FROM library_pages WHERE book_id = ?", (bid,))
        rows = []
        for i in range(pdf.page_count):
            try:
                text = pdf[i].get_text()
            except Exception:
                text = ""
            rows.append((bid, i + 1, text))
        pdf.close()

        cur.executemany(
            "INSERT INTO library_pages (book_id, page_num, text) VALUES (?, ?, ?)", rows
        )
        conn.commit()
        print(f"    wrote {len(rows)} pages")

    conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Pre-extract PDF page text.")
    parser.add_argument("--book-id", type=int, help="Only process this library_books.id")
    parser.add_argument("--force", action="store_true", help="Re-extract even if rows exist")
    args = parser.parse_args()
    extract(args.book_id, args.force)
    return 0


if __name__ == "__main__":
    sys.exit(main())
