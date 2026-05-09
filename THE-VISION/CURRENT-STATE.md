# Current State of Development

Last updated: 2026-05-07

## What Works

### Database (data/bible.db — 2.24 GB)
- **Bible text**: 425,420 verses across 13 translations (KJV, ASV, YLT, BSB, Darby, LEB, NETfree, NHEB, OEB, Rotherham, Webster, Wycliffe, KJVA)
- **Full-text search**: FTS5 indexes on bible_verses and commentary_entries — fast full-text search works
- **Commentary**: 539,318 entries from 10+ sources (TSK, Clarke, Luther, KD, MHCC, Wesley, JFB, MHC, Geneva, Barnes, and more)
- **Lexicon**: 94,063 Strong's entries
- **Library catalog**: 246 books catalogued (Commentary, Devotional, Theology, etc.)

### Backend — All 46 routes registered and imports clean
- `/api/bible/*` — chapter/verse/translation retrieval, comparison
- `/api/commentary/*` — verse commentary from multiple sources
- `/api/notes`, `/api/highlights`, `/api/bookmarks` — user study tools (persist to DB)
- `/api/search` — FTS5 full-text search across Bible + commentary
- `/api/ai/*` — Claude streaming AI (ask, explain, word-study, topic-study, outline, cross-refs)
- `/api/word-study/*`, `/api/lexicon/*` — Strong's lookup (data present, see gaps)
- `/api/reading-plans/*` — built-in plans + progress tracking
- `/api/library/*`, `/api/dictionary/*` — library catalog and dictionary lookup

### Frontend (pre-built in frontend/dist/)
- Bible reader with chapter/verse navigation
- Right panel with Commentary, AI Study, Notes, Word Study tabs
- Left sidebar for book/chapter selection
- Translation selector (auto-loads from API)
- Verse context menu (right-click for options)
- Full-text search modal (Cmd/Ctrl+K)
- Highlight colors per verse
- Persistent state via Zustand (localStorage)

### AI Assistant
- Streaming responses via Claude claude-sonnet-4-6
- Modes: ask a question, explain passage, word study, topic study, outline, cross-references
- Requires ANTHROPIC_API_KEY in environment (see ENVIRONMENT.md)

## Known Gaps / Broken

| Feature | Status | Notes |
|---------|--------|-------|
| Greek/Hebrew interlinear | Empty data | `greek_words` and `hebrew_words` tables are 0 rows — need to run `ingest/ingest_stepbible.py` with STEPBible TSV files |
| Dictionary entries | Empty | `dictionary_entries` table is 0 rows — ingest script needed |
| Library PDF reading | Broken | PDF files not physically present on this server (only catalog metadata in DB); also PyMuPDF has Nix binary compat issue |
| PyMuPDF | Disabled | `libstdc++.so.6` missing in Nix store — handled gracefully (503 response), won't crash server |
| Word study panel | Partially works | UI exists, lexicon data is present, but interlinear word links are empty |

## Data Ingestion Gap

The `ingest/` folder has 3 scripts:
- `ingest_sword.py` — loads SWORD module ZIPs (Bible translations + commentaries) ✅ already done
- `ingest_stepbible.py` — loads STEPBible TSV files (Greek/Hebrew tagged text) ❌ not done
- `ingest_pdfs.py` — indexes PDF books into library_books table ❌ not done (needs PDF files)

To enable Greek/Hebrew word study, you need the STEPBible data files and then run:
```bash
PYTHONPATH=.venv/lib/python3.11/site-packages \
  LIBRARY_PATH=/path/to/stepbible-data \
  python3 ingest/ingest_stepbible.py
```

## Environment Issues

- Python packages installed to `.venv/lib/python3.11/site-packages/` (Nix prevents system-wide installs)
- `start.sh` sets `PYTHONPATH` automatically
- `ANTHROPIC_API_KEY` must be set in Replit Secrets (Tools → Secrets)
