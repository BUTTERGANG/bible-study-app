#!/usr/bin/env python3
"""
Ingest STEPBible tagged Greek/Hebrew texts into SQLite.

STEPBible TSV format (TAGNT — NT Greek):
Col 0: Ref (e.g. Mat.1.1#01)
Col 1: Greek word
Col 2: Transliteration
Col 3: Pronunciation
Col 4: Morphology code (e.g. N-NSM)
Col 5: Strong's number (e.g. G2316)
Col 6: English gloss

STEPBible TSV format (TAHOT — OT Hebrew):
Similar structure but Hebrew words.

Usage:
    cd /Volumes/T5 EVO/REPLIT/LOGOS-COPYCAT/app
    python ingest/ingest_stepbible.py
"""

import os
import sys
import sqlite3
import re
from pathlib import Path

APP_DIR = Path(__file__).parent.parent
LIBRARY_DIR = Path(os.getenv("LIBRARY_PATH", APP_DIR.parent / "library"))
DATA_DIR = Path(os.getenv("DATA_PATH", APP_DIR / "data"))
STEPBIBLE_DIR = LIBRARY_DIR / "stepbible"
DB_PATH = DATA_DIR / "bible.db"

sys.path.insert(0, str(APP_DIR / "backend"))
from bible_data import BOOK_ABBREV_MAP, resolve_book_name

# STEPBible book abbreviation to canonical name mapping
STEPBIBLE_BOOK_MAP = {
    "Mat": "Matthew", "Mrk": "Mark", "Luk": "Luke", "Jhn": "John",
    "Act": "Acts", "Rom": "Romans", "1Co": "1 Corinthians", "2Co": "2 Corinthians",
    "Gal": "Galatians", "Eph": "Ephesians", "Phl": "Philippians", "Col": "Colossians",
    "1Th": "1 Thessalonians", "2Th": "2 Thessalonians", "1Ti": "1 Timothy", "2Ti": "2 Timothy",
    "Tit": "Titus", "Phm": "Philemon", "Heb": "Hebrews", "Jas": "James",
    "1Pe": "1 Peter", "2Pe": "2 Peter", "1Jo": "1 John", "2Jo": "2 John", "3Jo": "3 John",
    "Jud": "Jude", "Rev": "Revelation",
    # OT
    "Gen": "Genesis", "Exo": "Exodus", "Lev": "Leviticus", "Num": "Numbers",
    "Deu": "Deuteronomy", "Jos": "Joshua", "Jdg": "Judges", "Rut": "Ruth",
    "1Sa": "1 Samuel", "2Sa": "2 Samuel", "1Ki": "1 Kings", "2Ki": "2 Kings",
    "1Ch": "1 Chronicles", "2Ch": "2 Chronicles", "Ezr": "Ezra", "Neh": "Nehemiah",
    "Est": "Esther", "Job": "Job", "Psa": "Psalms", "Pro": "Proverbs",
    "Ecc": "Ecclesiastes", "Sng": "Song of Solomon", "Isa": "Isaiah",
    "Jer": "Jeremiah", "Lam": "Lamentations", "Eze": "Ezekiel", "Dan": "Daniel",
    "Hos": "Hosea", "Joe": "Joel", "Amo": "Amos", "Oba": "Obadiah",
    "Jon": "Jonah", "Mic": "Micah", "Nah": "Nahum", "Hab": "Habakkuk",
    "Zep": "Zephaniah", "Hag": "Haggai", "Zec": "Zechariah", "Mal": "Malachi",
}


def parse_ref(ref_str: str):
    """Parse STEPBible ref like 'Mat.1.1#01' → (book, chapter, verse, position)."""
    # Format: Book.Chapter.Verse#WordNum
    # or Book.Chapter.Verse (no word num)
    ref_str = ref_str.strip()
    parts = ref_str.split("#")
    word_num = int(parts[1]) if len(parts) > 1 else 1
    bcv = parts[0].split(".")
    if len(bcv) < 3:
        return None, None, None, None
    book_abbrev = bcv[0]
    chapter = int(bcv[1])
    verse = int(bcv[2])
    canonical = STEPBIBLE_BOOK_MAP.get(book_abbrev)
    return canonical, chapter, verse, word_num


def ingest_tagnt(conn: sqlite3.Connection):
    """Ingest TAGNT (Tagged Greek New Testament) files."""
    tagnt_dir = STEPBIBLE_DIR / "Tagged-Bibles"
    if not tagnt_dir.exists():
        print(f"  TAGNT directory not found: {tagnt_dir}")
        return 0

    # Find all TAGNT files
    tsv_files = sorted(tagnt_dir.glob("TAGNT*.txt")) + sorted(tagnt_dir.glob("TAGNT*.tsv"))
    if not tsv_files:
        tsv_files = sorted(tagnt_dir.glob("*TAGNT*"))

    if not tsv_files:
        print(f"  No TAGNT files found in {tagnt_dir}")
        print(f"  Contents: {list(tagnt_dir.iterdir())[:10]}")
        return 0

    print(f"  Found {len(tsv_files)} TAGNT files")

    # Check if already ingested
    count = conn.execute("SELECT COUNT(*) FROM greek_words").fetchone()[0]
    if count > 0:
        print(f"  Already have {count:,} Greek words — skipping")
        return count

    total = 0
    rows = []

    for tsv_file in tsv_files:
        print(f"  Processing {tsv_file.name}...")
        try:
            with open(tsv_file, "r", encoding="utf-8-sig") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or line.startswith("Ref"):
                        continue

                    cols = line.split("\t")
                    if len(cols) < 4:
                        continue

                    ref_col = cols[0]
                    canonical, chapter, verse, word_pos = parse_ref(ref_col)
                    if not canonical:
                        continue

                    greek = cols[1] if len(cols) > 1 else ""
                    translit = cols[2] if len(cols) > 2 else ""
                    pronunciation = cols[3] if len(cols) > 3 else ""
                    morphology = cols[4] if len(cols) > 4 else ""
                    strongs = cols[5] if len(cols) > 5 else ""
                    gloss = cols[6] if len(cols) > 6 else ""

                    # Clean up
                    strongs = strongs.strip().upper() if strongs else None
                    if strongs and not strongs.startswith("G"):
                        strongs = "G" + strongs.lstrip("0")

                    rows.append((canonical, chapter, verse, word_pos, greek, translit, morphology, strongs, gloss))
                    total += 1

                    if len(rows) >= 1000:
                        conn.executemany(
                            "INSERT INTO greek_words (book, chapter, verse, word_position, greek, transliteration, morphology, strongs_num, english_gloss) "
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            rows,
                        )
                        conn.commit()
                        rows = []

        except Exception as e:
            print(f"    Error processing {tsv_file.name}: {e}")

    if rows:
        conn.executemany(
            "INSERT INTO greek_words (book, chapter, verse, word_position, greek, transliteration, morphology, strongs_num, english_gloss) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()

    print(f"  Total Greek words ingested: {total:,}")
    return total


def ingest_tahot(conn: sqlite3.Connection):
    """Ingest TAHOT (Tagged Ancient Hebrew Old Testament) files."""
    tagnt_dir = STEPBIBLE_DIR / "Tagged-Bibles"
    if not tagnt_dir.exists():
        return 0

    tsv_files = sorted(tagnt_dir.glob("TAHOT*.txt")) + sorted(tagnt_dir.glob("TAHOT*.tsv"))
    if not tsv_files:
        tsv_files = sorted(tagnt_dir.glob("*TAHOT*"))

    if not tsv_files:
        print(f"  No TAHOT files found")
        return 0

    print(f"  Found {len(tsv_files)} TAHOT files")

    count = conn.execute("SELECT COUNT(*) FROM hebrew_words").fetchone()[0]
    if count > 0:
        print(f"  Already have {count:,} Hebrew words — skipping")
        return count

    total = 0
    rows = []

    for tsv_file in tsv_files:
        print(f"  Processing {tsv_file.name}...")
        try:
            with open(tsv_file, "r", encoding="utf-8-sig") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or line.startswith("Ref"):
                        continue

                    cols = line.split("\t")
                    if len(cols) < 4:
                        continue

                    canonical, chapter, verse, word_pos = parse_ref(cols[0])
                    if not canonical:
                        continue

                    hebrew = cols[1] if len(cols) > 1 else ""
                    translit = cols[2] if len(cols) > 2 else ""
                    morphology = cols[4] if len(cols) > 4 else ""
                    strongs = cols[5] if len(cols) > 5 else ""
                    gloss = cols[6] if len(cols) > 6 else ""

                    strongs = strongs.strip().upper() if strongs else None
                    if strongs and not strongs.startswith("H"):
                        strongs = "H" + strongs.lstrip("0")

                    rows.append((canonical, chapter, verse, word_pos, hebrew, translit, morphology, strongs, gloss))
                    total += 1

                    if len(rows) >= 1000:
                        conn.executemany(
                            "INSERT INTO hebrew_words (book, chapter, verse, word_position, hebrew, transliteration, morphology, strongs_num, english_gloss) "
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            rows,
                        )
                        conn.commit()
                        rows = []

        except Exception as e:
            print(f"    Error: {e}")

    if rows:
        conn.executemany(
            "INSERT INTO hebrew_words (book, chapter, verse, word_position, hebrew, transliteration, morphology, strongs_num, english_gloss) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()

    print(f"  Total Hebrew words ingested: {total:,}")
    return total


def main():
    print("=== STEPBible Ingestion ===\n")

    if not DB_PATH.exists():
        print(f"ERROR: bible.db not found at {DB_PATH}")
        print("Run ingest_sword.py first to create the database.")
        sys.exit(1)

    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

    print("--- Ingesting TAGNT (NT Greek) ---")
    ingest_tagnt(conn)

    print("\n--- Ingesting TAHOT (OT Hebrew) ---")
    ingest_tahot(conn)

    conn.close()
    print("\n=== DONE ===")


if __name__ == "__main__":
    main()
