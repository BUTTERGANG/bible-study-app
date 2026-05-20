# Lexicon & Dictionary Ingest Guide

## Current State

The database at `data/bible.db` is empty (no tables). The full 2.24 GB database
with all verses, commentary, lexicon, and interlinear data lives on the original
deployment server — not in this repo clone.

## What Needs to Be Ingested

| Table | Source | Script | Status |
|-------|--------|--------|--------|
| `bible_verses` | SWORD Bible modules | `ingest_sword.py` | Needs data |
| `commentary_entries` | SWORD commentary modules | `ingest_sword.py` | Needs data |
| `lexicon_entries` | SWORD Strong's Greek/Hebrew | `ingest_sword.py` | Needs data |
| `dictionary_entries` | Easton, ISBE, Nave, Smith, Webster1828 | `ingest_sword.py` | Needs data |
| `greek_words` | STEPBible interlinear export | `ingest_stepbible.py` | Needs data |
| `hebrew_words` | STEPBible interlinear export | `ingest_stepbible.py` | Needs data |
| `library_books` | PDF/epub files in `library/` | `ingest_sword.py` (auto) | Needs data |
| `library_pages` | PDF text extraction | `ingest_pdfs.py` | Needs data |

## Prerequisites

### 1. SWORD Module Data

You need the SWORD module zip files in `library/sword/`:

```
library/sword/
├── bibles/
│   ├── KJV.zip
│   ├── ASV.zip
│   ├── YLT.zip
│   ├── BSB.zip
│   ├── Darby.zip
│   ├── LEB.zip
│   ├── NETfree.zip
│   ├── NHEB.zip
│   ├── OEB.zip
│   ├── Rotherham.zip
│   ├── Webster.zip
│   ├── Wycliffe.zip
│   └── KJVA.zip
├── commentaries/
│   ├── MHC.zip
│   ├── JFB.zip
│   ├── TSK.zip
│   ├── Calvin.zip
│   ├── Barnes.zip
│   ├── Clarke.zip
│   ├── Wesley.zip
│   ├── Geneva.zip
│   ├── Luther.zip
│   ├── Lightfoot.zip
│   ├── KD.zip
│   ├── RWP.zip
│   ├── TFG.zip
│   ├── PNT.zip
│   ├── TDavid.zip
│   ├── Burkitt.zip
│   └── MHCC.zip
├── lexicons/
│   ├── StrongsGreek.zip
│   ├── StrongsHebrew.zip
│   ├── AbbottSmith.zip
│   └── Dodson.zip
└── classics/
    ├── Easton.zip
    ├── ISBE.zip
    ├── Smith.zip
    ├── Nave.zip
    └── Webster1828.zip
```

**Where to get them:**
- CrossWire SWORD repository: https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/
- Or copy from the original deployment server's `library/sword/` directory.

### 2. STEPBible Interlinear Data

The Greek/Hebrew interlinear words (`greek_words`, `hebrew_tables`) come from
STEPBible's open data export, processed by `ingest_stepbible.py`.

Source: https://stepbible.org/

### 3. Python Dependencies

```bash
pip install pysword PyMuPDF
```

## Running the Ingest

### Full Ingest (all SWORD modules)

```bash
cd /Volumes/T5 EVO/REPLIT/LOGOS
pip install -r requirements.txt
python ingest/ingest_sword.py
```

This will:
1. Create the database schema
2. Extract and ingest all Bible translations
3. Extract and ingest all commentary modules
4. Extract and ingest all lexicon/dictionary modules
5. Register library PDFs
6. Rebuild FTS5 search indexes

### Step-Bible Interlinear Ingest

```bash
python ingest/ingest_stepbible.py
```

### Library PDF Page Extraction

```bash
python ingest/ingest_pdfs.py
```

## Verifying the Ingest

```bash
sqlite3 data/bible.db "SELECT COUNT(*) FROM bible_verses;"
sqlite3 data/bible.db "SELECT COUNT(DISTINCT translation) FROM bible_verses;"
sqlite3 data/bible.db "SELECT COUNT(*) FROM commentary_entries;"
sqlite3 data/bible.db "SELECT COUNT(*) FROM lexicon_entries;"
sqlite3 data/bible.db "SELECT COUNT(*) FROM dictionary_entries;"
sqlite3 data/bible.db "SELECT COUNT(*) FROM greek_words;"
sqlite3 data/bible.db "SELECT COUNT(*) FROM hebrew_words;"
sqlite3 data/bible.db "SELECT COUNT(*) FROM library_books;"
```

Expected counts (approximate):
- 31,102+ Bible verses per translation × 13 translations ≈ 400K+ rows
- ~539,000 commentary entries
- ~137,000 Greek words
- ~264,000 Hebrew words
- ~726 lexicon entries
- ~246 library books

## Troubleshooting

- **"pysword not installed"**: `pip install pysword`
- **"Module not found"**: Check the zip file exists in the right `library/sword/` subdirectory
- **Empty dictionary_entries**: The dictionary modules (Easton, ISBE, etc.) may be in `classics/` not `lexicons/` — the script checks both
- **FTS rebuild fails**: Non-fatal; FTS indexes will be rebuilt on next ingest run
