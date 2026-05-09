# Database Reference

## File
`data/bible.db` — SQLite, 2.24 GB

## Tables

| Table | Rows | Notes |
|-------|------|-------|
| `bible_verses` | 425,420 | All translations, books, chapters, verses |
| `bible_verses_fts` | 425,420 | FTS5 full-text search index |
| `commentary_entries` | 539,318 | Multi-source verse-level commentary |
| `commentary_fts` | 539,318 | FTS5 search index for commentary |
| `lexicon_entries` | 94,063 | Strong's Hebrew + Greek lexicon |
| `library_books` | 246 | Book catalog (no PDF files on server) |
| `dictionary_entries` | 0 | Empty — needs ingestion |
| `greek_words` | 0 | Empty — needs STEPBible ingestion |
| `hebrew_words` | 0 | Empty — needs STEPBible ingestion |
| `notes` | 0 (grows) | User study notes |
| `highlights` | 0 (grows) | Verse highlights |
| `bookmarks` | 0 (grows) | Verse bookmarks |
| `reading_plans` | 0 (grows) | User reading plans |
| `reading_plan_progress` | 0 (grows) | Plan completion tracking |
| `studies` | 0 (grows) | Saved AI study sessions |

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

> Note: Library book catalog is populated but the actual PDF/source files are not
> present on this Replit instance. The library API will return 404 for page reads.

## Key Schema Notes

- `BibleVerse.book` stores the canonical book name (e.g., "John", "Genesis")
- `BibleVerse.book_num` is used for ordering (1=Genesis ... 66=Revelation)
- Commentary is verse-range aware: `verse_start` ≤ verse ≤ `verse_end` (or NULL)
- `LexiconEntry.strongs_num` format: "G3056" for Greek, "H1234" for Hebrew

## Google Drive Source

Original database file: folder `1B0g2n8cj0yXsqB2qHGgHhLZ6iPQalP84`
File: `bible.db` (file ID: `1h2tqcOb7XnM5AiLpqHL6z7G8OUzJogP_`)
