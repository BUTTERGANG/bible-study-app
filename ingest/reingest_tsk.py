#!/usr/bin/env python3
"""Re-ingest TSK (Treasury of Scripture Knowledge) cross-references from the SWORD module.

The original ingest used clean=True which stripped <scripRef> tags, leaving only
keyword fragments ("God.gave.that whosoever.") instead of actual cross-references.

This script:
1. Downloads TSK.zip from CrossWire (or uses a local copy)
2. Parses raw ThML content to extract <scripRef> cross-reference text
3. Resolves abbreviated book names and relative chapter:verse references
4. Stores clean text like "Luke 2:14; Genesis 22:12; Mark 12:6; Romans 5:10; 8:32"

Usage:
    cd /home/runner/workspace
    python3 ingest/reingest_tsk.py
"""

import re
import sqlite3
import sys
import tempfile
import urllib.request
import zipfile
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.bible_data import BOOKS, resolve_book_name

DB_PATH = Path(__file__).parent.parent / "data" / "bible.db"
TSK_ZIP_URL = "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/TSK.zip"
TSK_ZIP_LOCAL = Path("/tmp/TSK.zip")

# Pysword returns Roman numeral book names — map them to canonical names
PYSWORD_BOOK_MAP = {
    "I Samuel": "1 Samuel", "II Samuel": "2 Samuel",
    "I Kings": "1 Kings", "II Kings": "2 Kings",
    "I Chronicles": "1 Chronicles", "II Chronicles": "2 Chronicles",
    "I Corinthians": "1 Corinthians", "II Corinthians": "2 Corinthians",
    "I Thessalonians": "1 Thessalonians", "II Thessalonians": "2 Thessalonians",
    "I Timothy": "1 Timothy", "II Timothy": "2 Timothy",
    "I Peter": "1 Peter", "II Peter": "2 Peter",
    "I John": "1 John", "II John": "2 John", "III John": "3 John",
    "Revelation of John": "Revelation",
}

# TSK uses its own set of book abbreviations (some differ from SWORD standard)
TSK_ABBREV = {
    # OT
    "Ge": "Genesis", "Ex": "Exodus", "Le": "Leviticus", "Nu": "Numbers",
    "De": "Deuteronomy", "Jos": "Joshua", "Jud": "Judges", "Ru": "Ruth",
    "1Sa": "1 Samuel", "2Sa": "2 Samuel", "1Ki": "1 Kings", "2Ki": "2 Kings",
    "1Ch": "1 Chronicles", "2Ch": "2 Chronicles", "Ezr": "Ezra", "Ne": "Nehemiah",
    "Es": "Esther", "Job": "Job", "Ps": "Psalms", "Pr": "Proverbs",
    "Ec": "Ecclesiastes", "So": "Song of Solomon", "Isa": "Isaiah",
    "Jer": "Jeremiah", "La": "Lamentations", "Eze": "Ezekiel", "Da": "Daniel",
    "Ho": "Hosea", "Joe": "Joel", "Am": "Amos", "Ob": "Obadiah",
    "Jon": "Jonah", "Mic": "Micah", "Na": "Nahum", "Hab": "Habakkuk",
    "Zep": "Zephaniah", "Hag": "Haggai", "Zec": "Zechariah", "Mal": "Malachi",
    # NT
    "Mt": "Matthew", "Mr": "Mark", "Lu": "Luke", "Joh": "John",
    "Ac": "Acts", "Ro": "Romans", "1Co": "1 Corinthians", "2Co": "2 Corinthians",
    "Ga": "Galatians", "Eph": "Ephesians", "Php": "Philippians", "Col": "Colossians",
    "1Th": "1 Thessalonians", "2Th": "2 Thessalonians", "1Ti": "1 Timothy",
    "2Ti": "2 Timothy", "Tit": "Titus", "Phm": "Philemon", "Heb": "Hebrews",
    "Jas": "James", "1Pe": "1 Peter", "2Pe": "2 Peter", "1Jo": "1 John",
    "2Jo": "2 John", "3Jo": "3 John", "Jude": "Jude", "Re": "Revelation",
}

# Regex to split a <scripRef> list: "Ge 22:12; Mr 12:6; Ro 5:10; 8:32"
# Each token is either "Abbrev ch:v" or bare "ch:v" (relative to last named book)
_REF_TOKEN = re.compile(
    r'([A-Z][a-z0-9]*(?:\s+[A-Z][a-z]*)?)\s+(\d+):(\d+)(?:[,-](\d+))?'
    r'|(\d+):(\d+)(?:[,-](\d+))?'
)
_SCRIPREF = re.compile(r'<scripRef[^>]*>(.*?)</scripRef>', re.DOTALL | re.IGNORECASE)


def _resolve_abbrev(raw: str) -> str | None:
    """Return canonical book name for a TSK abbreviation."""
    raw = raw.strip()
    if raw in TSK_ABBREV:
        return TSK_ABBREV[raw]
    return resolve_book_name(raw, fuzzy=False) or resolve_book_name(raw, fuzzy=True)


def parse_scripref(ref_text: str, base_book: str) -> list[str]:
    """Parse a <scripRef> contents into a list of formatted references.

    e.g. "1:14,18; Ge 22:12; Mr 12:6; Ro 5:10; 8:32" →
         ["John 1:14", "John 1:18", "Genesis 22:12", "Mark 12:6",
          "Romans 5:10", "Romans 8:32"]
    """
    results = []
    current_book = base_book  # tracks last explicitly named book

    # Split on semicolons to process each reference group
    for segment in ref_text.split(";"):
        segment = segment.strip()
        if not segment:
            continue

        # Try to match a book-qualified reference: "Ge 22:12" or "Ro 5:10"
        # or a bare chapter:verse "1:14,18" or "8:32"

        # First check if this segment starts with a book abbreviation
        # Book abbrevs: start with capital, optionally followed by lowercase/digits
        book_match = re.match(
            r'^([1-3]?\s*[A-Z][a-z0-9]+(?:\s+[A-Z][a-z]+)?)\s+(\d+):(\d+)((?:[,-]\d+)*)',
            segment
        )
        bare_match = re.match(r'^(\d+):(\d+)((?:[,-]\d+)*)', segment)

        if book_match:
            abbrev = book_match.group(1).strip()
            chapter = int(book_match.group(2))
            verse_start = int(book_match.group(3))
            extra = book_match.group(4)  # e.g. ",18" or "-21"

            canonical = _resolve_abbrev(abbrev)
            if canonical:
                current_book = canonical
                results.append(f"{canonical} {chapter}:{verse_start}")
                if extra:
                    for v in re.findall(r'\d+', extra):
                        results.append(f"{canonical} {chapter}:{v}")
        elif bare_match:
            chapter = int(bare_match.group(1))
            verse_start = int(bare_match.group(2))
            extra = bare_match.group(3)

            results.append(f"{current_book} {chapter}:{verse_start}")
            if extra:
                for v in re.findall(r'\d+', extra):
                    results.append(f"{current_book} {chapter}:{v}")
        else:
            # Could be just a verse number relative to last chapter seen,
            # or malformed — skip
            pass

    return results


def extract_refs_from_thml(raw_thml: str, base_book: str) -> str:
    """Extract all cross-references from a TSK ThML entry and return as
    a semicolon-separated string of canonical references.

    e.g. "John 1:14; John 1:18; Genesis 22:12; Mark 12:6; Romans 5:10; Romans 8:32"
    """
    all_refs = []
    seen = set()

    for m in _SCRIPREF.finditer(raw_thml):
        ref_content = unescape(m.group(1)).strip()
        refs = parse_scripref(ref_content, base_book)
        for r in refs:
            if r not in seen:
                seen.add(r)
                all_refs.append(r)

    return "; ".join(all_refs)


def get_tsk_zip() -> Path:
    if TSK_ZIP_LOCAL.exists() and TSK_ZIP_LOCAL.stat().st_size > 100_000:
        print(f"Using cached {TSK_ZIP_LOCAL}")
        return TSK_ZIP_LOCAL
    print(f"Downloading TSK from {TSK_ZIP_URL} ...")
    urllib.request.urlretrieve(TSK_ZIP_URL, TSK_ZIP_LOCAL)
    print(f"Downloaded {TSK_ZIP_LOCAL.stat().st_size:,} bytes")
    return TSK_ZIP_LOCAL


def main():
    zip_path = get_tsk_zip()

    # Extract to temp dir
    extract_dir = Path(tempfile.mkdtemp(prefix="tsk_"))
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(extract_dir)
    print(f"Extracted to {extract_dir}")

    # Load with pysword
    from pysword.modules import SwordModules
    modules = SwordModules(str(extract_dir))
    modules.parse_modules()
    mod_info = modules._modules["TSK"]
    mod_info["moddrv"] = "zText"  # patch so pysword reads zCom as zText
    tsk = modules.get_bible_from_module("TSK")
    struct = tsk.get_structure()
    books_dict = struct.get_books()
    all_books = books_dict.get("ot", []) + books_dict.get("nt", [])
    print(f"TSK covers {len(all_books)} books")

    # Connect to DB
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Delete existing TSK entries
    print("Removing existing TSK entries...")
    conn.execute("DELETE FROM commentary_entries WHERE source='TSK'")
    conn.commit()
    print("Cleared.")

    book_map = {b["name"]: b for b in BOOKS}
    total = 0
    rows = []

    for book_obj in all_books:
        canonical = PYSWORD_BOOK_MAP.get(book_obj.name) or resolve_book_name(book_obj.name) or book_obj.name
        b_info = book_map.get(canonical)
        if not b_info:
            print(f"  Skipping unknown book: {book_obj.name!r}")
            continue

        for ch_idx, verse_count in enumerate(book_obj.chapter_lengths):
            ch_num = ch_idx + 1
            for v_num in range(1, verse_count + 1):
                try:
                    raw = tsk.get(
                        books=[book_obj.name],
                        chapters=[ch_num],
                        verses=[v_num],
                        clean=False,
                    )
                    if not raw or not raw.strip():
                        continue

                    ref_text = extract_refs_from_thml(raw, canonical)
                    if not ref_text:
                        continue

                    rows.append(("TSK", canonical, ch_num, v_num, None, ref_text))
                    total += 1

                except Exception:
                    pass

            if len(rows) >= 1000:
                conn.executemany(
                    "INSERT INTO commentary_entries "
                    "(source, book, chapter, verse_start, verse_end, text) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    rows,
                )
                conn.commit()
                rows = []

        print(f"  {canonical}: done")

    if rows:
        conn.executemany(
            "INSERT INTO commentary_entries "
            "(source, book, chapter, verse_start, verse_end, text) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()

    print(f"\nIngested {total:,} TSK cross-reference entries")

    # Rebuild FTS
    print("Rebuilding FTS index...")
    conn.execute("INSERT INTO commentary_fts(commentary_fts) VALUES('rebuild')")
    conn.commit()
    print("FTS rebuild done.")
    conn.close()

    # Spot check
    conn2 = sqlite3.connect(DB_PATH)
    row = conn2.execute(
        "SELECT text FROM commentary_entries WHERE source='TSK' "
        "AND book='John' AND chapter=3 AND verse_start=16"
    ).fetchone()
    print(f"\nSpot check John 3:16: {row[0] if row else 'NOT FOUND'}")

    row2 = conn2.execute(
        "SELECT text FROM commentary_entries WHERE source='TSK' "
        "AND book='Genesis' AND chapter=1 AND verse_start=2"
    ).fetchone()
    print(f"Spot check Genesis 1:2: {row2[0] if row2 else 'NOT FOUND'}")
    conn2.close()


if __name__ == "__main__":
    main()
