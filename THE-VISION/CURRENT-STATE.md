# Current State of Development

Last updated: 2026-05-16

## What Works

### Database (data/bible.db — 2.24 GB)
- **Bible text**: 394,338 verses across 13 translations (KJV, ASV, YLT, BSB, Darby, LEB, NETfree, NHEB, OEB, Rotherham, Webster, Wycliffe, KJVA)
- **Full-text search**: FTS5 indexes on bible_verses and commentary_entries — fast full-text search works
- **Commentary**: 539,318 entries from 15 sources (TSK, Clarke, Luther, KD, MHCC, Wesley, JFB, MHC, Geneva, Barnes, RWP, Burkitt, PNT, Lightfoot, TDavid)
- **Lexicon**: 726 clean Dodson Greek entries (rebuilt 2026-05-16 — see "Known Gaps" below)
- **Greek interlinear**: 137,442 words — full NT (STEPBible TAGNT, loaded 2026-05-16)
- **Hebrew interlinear**: 264,529 words — full OT (STEPBible TAHOT, loaded 2026-05-16)
- **Library catalog**: 246 books catalogued

### Backend — 40 API routes, proper Python package
Located in `backend/`, importable as `backend.main:app`. Launch with
`python -m uvicorn backend.main:app` (the old `cd backend` hack is gone).

Routers (one resource per file):
- `routers/health.py` — `/api/health`, `/api/auth/status` (DB-readiness aware)
- `routers/bible.py` — chapter/verse retrieval, translation list, compare
- `routers/commentary.py` — verse + chapter commentary, multi-source
- `routers/search.py` — FTS5 across Bible + commentary (FTS availability detected at startup, not via try/except)
- `routers/notes.py` — verse/chapter notes (queried by `book` + `chapter` + optional `verse`)
- `routers/highlights.py` — atomic UPSERT via SQLite ON CONFLICT (no race)
- `routers/bookmarks.py`
- `routers/reading_plans.py` — built-in plans, today's readings (single-query, no N+1), completion
- `routers/word_study.py` — Greek/Hebrew per-verse word lookup
- `routers/lexicon.py` — Strong's entries, occurrences
- `routers/library.py` — book catalog + page fetch (prefers pre-extracted `library_pages` table, falls back to live PyMuPDF)
- `routers/dictionary.py` — dictionary lookup
- `routers/ai.py` — Claude streaming endpoints (auth + rate-limited at the router level)

Cross-cutting:
- `backend/auth.py` — optional shared-secret middleware. When `APP_PASSWORD` is set, write endpoints and AI endpoints require `Authorization: Bearer <pw>` or `X-App-Password`.
- `backend/rate_limit.py` — in-memory per-IP token bucket on `/api/ai/*` (defaults: 15/min, 120/hr).
- `backend/database.py` — async engine + `db_status()` helper for the health endpoint and the startup banner.

### Frontend (pre-built in frontend/dist/)
- Bible reader with chapter/verse navigation
- **URL is canonical** (`/{translation}/{book}/{chapter}/{verse?}` via React Router) — refresh, share, browser-back all work
- Right panel with Commentary, AI Study, Notes, Word Study tabs — code-split so the AI bundle (164 KB) loads only when opened
- Left sidebar for book/chapter selection
- Translation selector (auto-loads from API, single shared cache entry)
- Verse context menu (right-click for options)
- Full-text search modal (Cmd/Ctrl+K, lazy-loaded)
- Highlight colors per verse (server enforces uniqueness)
- Auth gate component that prompts for password when `APP_PASSWORD` is configured
- Zustand persists UI preferences only (theme, font size, open panel) — navigation lives in the URL

### AI Assistant
- Streaming responses via Claude `claude-sonnet-4-6`
- **Prompt caching** (`cache_control`) on the system prompt and chapter-text block — multi-turn conversations don't re-bill the same tokens
- Auto-includes the currently visible chapter from the React Query cache
- Per-IP rate limiting, optional shared-secret auth
- Modes: ask a question, explain passage, word study, topic study, outline, cross-references
- Requires `ANTHROPIC_API_KEY` (see ENVIRONMENT.md)

### Tests, lint, migrations
- `make test` — 26 pytest tests covering Bible read paths, search FTS + snippet centering, notes/highlights upsert, book-name resolution, auth gate, and the SPA-swallows-API regression
- `make lint` — ruff (`pyproject.toml`)
- `make frontend-lint` — ESLint flat config (`frontend/eslint.config.js`)
- `make migrate` — alembic. One baseline migration (`alembic/versions/0001_initial_schema.py`) brings existing DBs up to current schema; idempotent

## Known Gaps / Broken

| Feature | Status | Notes |
|---------|--------|-------|
| Greek/Hebrew interlinear | **Working** | 137K Greek + 264K Hebrew words loaded from STEPBible (2026-05-16). Word Study tab shows original language words per verse with Strong's, morphology, transliteration |
| Dictionary entries | Empty | `dictionary_entries` table is 0 rows. Re-run `ingest/ingest_sword.py` against the SWORD source data — the routing bug is now fixed (2026-05-16) so dictionary modules (Easton, ISBE, Nave, Smith, Webster1828) will populate this table |
| Lexicon coverage | Reduced | Down from 94K corrupted rows to 726 clean Dodson entries. The earlier ingest used a broken zLD parser that produced binary garbage in `definition` and put dictionary headwords in `strongs_num`. Both bugs are now fixed in `ingest/ingest_sword.py`. Re-run the ingest against SWORD source data to restore full Strong's coverage (Greek + Hebrew) |
| Library PDF reading | Partially works | PDFs are not on this server. Production should run `python -m ingest.extract_pdf_pages` once to populate `library_pages`; after that, the API serves without PyMuPDF |
| PyMuPDF runtime | Brittle on Nix | `libstdc++.so.6` mismatch handled by `start.sh` via `LD_LIBRARY_PATH`. Pre-extracted pages avoid the dependency entirely |
| Word study panel | **Working** | Full Greek/Hebrew word data now loaded. Click any verse, open Word Study tab to see original language words with Strong's, morphology, transliteration, gloss |
| Compare-translations UI | Not wired | API endpoint exists (`/api/bible/compare-translations/...`); no UI surface yet |
| Reading-plan UI | Not wired | All 3 backend endpoints work (built-in, start, today, complete); needs a frontend tab |

## Data Ingestion Gap

The `ingest/` folder has these scripts:
- `ingest_sword.py` — loads SWORD module ZIPs (Bible translations, commentaries, lexica, dictionaries). Bible + commentary loaded ✅; lexicon/dictionary needs re-ingest after 2026-05-16 parser + routing fix
- `ingest_stepbible.py` — loads STEPBible TSV files (Greek/Hebrew tagged text) ✅ done — parser fixed and 401K words loaded
- `ingest_pdfs.py` — indexes PDF books into `library_books` table ❌ not done (needs PDF files)
- `extract_pdf_pages.py` — pre-extracts PDF page text into `library_pages` so the production app doesn't need PyMuPDF at runtime

### 2026-05-16 ingest fixes (re-run required for lexicon/dictionary)

`ingest/ingest_sword.py` had two latent bugs:

1. **Wrong zLD parser.** `_read_zld_module` used a heuristic block-to-key alignment (`entries_per_block = len(keys) // num_blocks`) that doesn't match SWORD's actual format. Each `.idx` record pointed to a `.dat` header containing the real `<block_num>:<entry_idx>` pointer — that path is now used. The previous parser produced binary garbage in ~50% of `definition` fields.
2. **Wrong table routing.** All lexicon/dictionary modules were dumped into `lexicon_entries` regardless of whether they were Strong's-keyed or term-keyed. `Easton`, `ISBE`, `Nave`, `Smith`, `Webster1828` now go to `dictionary_entries`; `StrongsGreek`, `StrongsHebrew`, `AbbottSmith`, `Dodson` stay in `lexicon_entries`.

The corrupted rows have already been deleted from `data/bible.db` (94,063 → 726 clean entries). To restore full coverage, re-run on a host with the SWORD library:

```bash
LIBRARY_PATH=/path/to/library python3 -m ingest.ingest_sword
```

Greek/Hebrew word study is now live. If the DB is ever wiped and needs to be rebuilt, re-download the STEPBible TSV files and run:
```bash
LIBRARY_PATH=/home/runner/workspace/data \
  DATA_PATH=/home/runner/workspace/data \
  python3 ingest/ingest_stepbible.py
```
The 6 TSV files (TAGNT Mat-Jhn, TAGNT Act-Rev, TAHOT Gen-Deu, TAHOT Jos-Est, TAHOT Job-Sng, TAHOT Isa-Mal) are downloaded from the STEPBible GitHub repo at no cost (CC BY 4.0) — see `THE-VISION/DATA.md` for the download commands.

To make library books readable in production:
```bash
PYTHONPATH=.venv/lib/python3.11/site-packages \
  python3 -m ingest.extract_pdf_pages [--book-id N] [--force]
```

## Environment Issues

- Python packages installed to `.venv/lib/python3.11/site-packages/` (Nix prevents system-wide installs)
- `start.sh` sets `PYTHONPATH` automatically and skips reinstall when packages are already importable
- `ANTHROPIC_API_KEY` must be set in Replit Secrets (Tools → Secrets)
- Optional: `APP_PASSWORD`, `CORS_ORIGINS`, `AI_RATE_LIMIT_PER_MIN`, `AI_RATE_LIMIT_PER_HOUR` — see ENVIRONMENT.md
