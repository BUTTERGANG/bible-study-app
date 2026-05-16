# Database Reference

Last updated: 2026-05-16

## File
`data/bible.db` — SQLite, 2.24 GB

## Tables

### Content (read-only — bulk-loaded by ingest scripts)

| Table | Rows | Notes |
|-------|------|-------|
| `bible_verses` | 394,338 | All translations, books, chapters, verses |
| `bible_verses_fts` | 394,338 | FTS5 full-text search index |
| `commentary_entries` | 539,318 | Multi-source verse-level commentary |
| `commentary_fts` | 539,318 | FTS5 search index for commentary |
| `lexicon_entries` | 726 | Strong's Greek (Dodson). Reduced from 94K corrupted rows on 2026-05-16 after a parser bug was found — re-run `ingest_sword.py` to restore full coverage |
| `library_books` | 246 | Book catalog (no PDF files on this server) |
| `dictionary_entries` | 0 | Empty — re-run `ingest_sword.py` (now routes Easton/ISBE/Nave/Smith/Webster1828 here correctly) |
| `greek_words` | 137,442 | Full NT — STEPBible TAGNT, loaded 2026-05-16 |
| `hebrew_words` | 264,529 | Full OT — STEPBible TAHOT, loaded 2026-05-16 |
| `library_pages` | 0 | Pre-extracted PDF page text. Populate with `python -m ingest.extract_pdf_pages` to make library books readable without runtime PyMuPDF |

### User-mutable (grows in use)

| Table | Notes |
|-------|-------|
| `notes` | Verse/chapter notes. Keyed by `(book, chapter, verse?)`. The old denormalized `reference` column was dropped — references are derived in the response payload |
| `highlights` | UNIQUE`(translation, book, chapter, verse)`. Atomic UPSERT via SQLite ON CONFLICT — no read-then-write race |
| `bookmarks` | Verse/chapter bookmarks. Denormalized `reference` column dropped |
| `reading_plans` | Plan metadata. `schedule_json` blob removed; days now live in `reading_plan_days` |
| `reading_plan_days` | **New** — one row per (plan, date, reference). Lets `/api/reading-plans/today` do a single-query lookup across all plans |
| `reading_plan_progress` | UNIQUE`(plan_id, date, reference)` so completion is upsert-safe |

Removed in the 2026-05-15 refactor:
- `studies` — was declared but unused; dropped via alembic migration `0001`

### 2026-05-16 lexicon cleanup

The pre-existing `lexicon_entries` table held 94,063 rows produced by a broken
zLD parser in `ingest/ingest_sword.py` (heuristic block alignment instead of
honoring the `.dat` entry pointers). About 50% of `definition` values were
binary garbage, and dictionary modules (Easton, ISBE, Nave, Smith, Webster1828)
had their headword stuffed into `strongs_num` because there was no routing logic.

Both bugs are now fixed in `ingest/ingest_sword.py`:

- `_read_zld_module` parses the `.dat` entry header (`KEY\n<block_num>:<entry_idx>\n`)
  and pulls the exact null-terminated chunk from the decompressed zdt block.
- `STRONGS_LEXICON_MODULES` / `DICTIONARY_MODULES` sets route Strong's-keyed
  data to `lexicon_entries` and term-keyed data to `dictionary_entries`.

Corrupt rows have already been removed from the live DB (94,063 → 726). To
restore full lexicon + dictionary coverage, re-run the ingest against the
SWORD source data.

## Bible Translations

ASV, BSB, Darby, KJV, KJVA, LEB, NETfree, NHEB, OEB, Rotherham, Webster, Wycliffe, YLT

## Commentary Sources

| ID | Name | Entries |
|----|------|---------|
| TSK | Treasury of Scripture Knowledge | 78,903 |
| Clarke | Adam Clarke's Commentary | 63,156 |
| Luther | Luther's Commentary | 62,174 |
| KD | Keil & Delitzsch | 62,005 |
| MHCC | Matthew Henry's Concise | 57,436 |
| Wesley | Wesley's Notes | 54,372 |
| JFB | Jamieson, Fausset & Brown | 49,626 |
| MHC | Matthew Henry's Commentary | 31,098 |
| Geneva | Geneva Bible Notes | 29,546 |
| Barnes | Barnes' Notes | 22,311 |

## Library Book Categories

| Category | Books |
|----------|-------|
| Commentary | 144 |
| Book Notes | 24 |
| Bible Translation | 24 |
| Devotional | 16 |
| Church History | 16 |
| Study Bible | 12 |
| Theology | 8 |
| Lexicons | 2 |

> Library book catalog is populated but the actual PDF/source files are not
> present on this Replit instance. Run `python -m ingest.extract_pdf_pages`
> against an environment that has the PDFs to pre-extract text into
> `library_pages` — the production app then serves library content without
> PyMuPDF at runtime.

## Key Schema Notes

- `BibleVerse.book` stores the canonical book name (e.g., "John", "Genesis")
- `BibleVerse.book_num` is used for ordering (1=Genesis ... 66=Revelation)
- Commentary is verse-range aware: `verse_start` ≤ verse ≤ `verse_end` (or NULL)
- `LexiconEntry.strongs_num` format: "G3056" for Greek, "H1234" for Hebrew
- All user-mutable tables use canonical book names (resolved via `bible_data.resolve_book_name` at insert time — aliases and abbreviations are normalized server-side)

## Migrations

Schema is managed by alembic. Apply against an existing DB:

```bash
make migrate   # or: python -m alembic upgrade head
```

The baseline migration (`alembic/versions/0001_initial_schema.py`) is
idempotent — it inspects the live schema and only applies missing pieces
(uniqueness constraints, new tables, column drops). Safe to run multiple
times against any state.

## STEPBible Source (Greek/Hebrew interlinear)

License: CC BY 4.0 — free for any use with attribution.
Source: https://github.com/STEPBible/STEPBible-Data (directory: `Translators Amalgamated OT+NT`)

To re-download and re-ingest after a DB wipe:
```bash
BASE="https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT"
DEST="/home/runner/workspace/data/stepbible/Tagged-Bibles"
mkdir -p "$DEST"

# NT Greek (2 files)
curl -L "$BASE/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt" -o "$DEST/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt"
curl -L "$BASE/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt" -o "$DEST/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt"

# OT Hebrew (4 files)
curl -L "$BASE/TAHOT%20Gen-Deu%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt" -o "$DEST/TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt"
curl -L "$BASE/TAHOT%20Jos-Est%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt" -o "$DEST/TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt"
curl -L "$BASE/TAHOT%20Job-Sng%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt" -o "$DEST/TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt"
curl -L "$BASE/TAHOT%20Isa-Mal%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt" -o "$DEST/TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt"

# Then ingest:
LIBRARY_PATH=/home/runner/workspace/data DATA_PATH=/home/runner/workspace/data python3 ingest/ingest_stepbible.py
```

## Google Drive Source

Original database file: folder `1B0g2n8cj0yXsqB2qHGgHhLZ6iPQalP84`
File: `bible.db` (file ID: `1h2tqcOb7XnM5AiLpqHL6z7G8OUzJogP_`)
