# Roadmap

Last updated: 2026-05-16

## Recently Shipped (2026-05-16 — part 2)

- **Greek/Hebrew interlinear live** — 137,442 NT Greek + 264,529 OT Hebrew words ingested from STEPBible (CC BY 4.0). Word Study tab now shows original language words with Strong's number, morphology, transliteration, and English gloss for every verse
- **Fixed `ingest_stepbible.py` parser** — rewrote column mapping and ref parsing to match the actual Translators Amalgamated TSV format (previous version was written for an older format); added `parse_strongs_greek` and `parse_strongs_hebrew` helpers to cleanly extract Strong's codes from compound fields like `H9003/{H7225G}`

## Recently Shipped (2026-05-16 — part 1)

- **Ingest: fixed zLD parser** — `_read_zld_module` in `ingest/ingest_sword.py` now uses the `.dat` entry header (`KEY\n<block_num>:<entry_idx>\n`) to locate text, eliminating binary garbage that corrupted ~50% of `lexicon_entries` definitions
- **Ingest: fixed lexicon/dictionary routing** — dictionary modules (Easton, ISBE, Nave, Smith, Webster1828) now route to `dictionary_entries`; Strong's lexica (StrongsGreek, StrongsHebrew, AbbottSmith, Dodson) stay in `lexicon_entries`
- **DB cleanup** — removed 93,337 corrupted `lexicon_entries` rows; normalized `strongs_num` field; 726 clean Dodson entries remain (full coverage restored after re-ingest against SWORD source data)
- **Frontend empty states** — CommentaryPanel and WordStudyPanel no longer show internal ingest script paths to end users; copy is now user-facing
- **`.gitignore` cleaned** — `frontend/dist/` added (was previously tracked); stale built assets untracked; `backend/*.db*` patterns added

## Recently Shipped (2026-05-15 refactor)

- Backend is now a real Python package; `sys.path` hacks removed across all routers
- Notes / highlights / bookmarks / library / dictionary / word-study / lexicon routers split into single-resource files
- Optional shared-secret auth (`APP_PASSWORD`) + per-IP AI rate limit
- Anthropic prompt caching (`cache_control`) on system prompt + chapter-text block
- AI Assistant auto-includes chapter text from React Query cache
- URL routing — passages are shareable at `/{translation}/{book}/{chapter}/{verse?}`
- `react-markdown` replaces the custom 138-line renderer; code-split right-panel tabs
- Schema: `Highlight` UNIQUE constraint, normalized `reading_plan_days` and `library_pages` tables, dropped denormalized `reference` columns and unused `Study` table
- Alembic configured with baseline migration; 26 pytest tests; ruff + ESLint configs; Makefile

## Priority 1 — Complete Core Study Features

### 1.1 Greek/Hebrew Interlinear ✅ DONE
- 137K Greek words (full NT) + 264K Hebrew words (full OT) loaded from STEPBible
- Word Study tab live — click any verse to see original language breakdown
- Next step: clicking a word should deep-link to Strong's lexicon entry and show all occurrences across the Bible (backend `/api/lexicon/strongs/{num}` + `/api/lexicon/occurrences/{num}` already exist; the UI shows the data but could be richer)

### 1.2 Biblical Dictionary
- `dictionary_entries` table is empty but routing is now correct (2026-05-16 fix)
- Re-run `ingest/ingest_sword.py` against SWORD source data — Easton, ISBE, Nave, Smith, Webster1828 will populate this table
- UI hookup (`api.searchDictionary`, `api.getDictionaryEntry`) already exists in `api/client.js`; needs a frontend panel to surface it

### 1.3 Reading Plan UI
- Backend fully implemented (4 built-in plans + custom + today + complete + delete)
- No dedicated frontend panel exists yet — add a new tab in `RightPanel` or a top-level route
- Today's readings already available at `/api/reading-plans/today`

## Priority 2 — Frontend UX Improvements

### 2.1 Translation compare view
- `/api/bible/compare-translations/{book}/{chapter}/{verse}` already works
- Add a UI toggle to show multiple translations side-by-side for the current verse
- Could live as a new RightPanel tab or as an inline expansion on verse-select

### 2.2 Commentary source picker
- User should be able to select which commentary source(s) to show
- Currently defaults to all sources — can get verbose for popular verses
- Backend accepts `?sources=` already; surface it in `CommentaryPanel.jsx`

### 2.3 Verse sharing / export
- URL-routing already makes references shareable. Add a "Copy link" action to `VerseContextMenu`
- Export a passage + notes as formatted text/markdown

### 2.4 Bookmarks panel
- Bookmark mutation is wired in the verse context menu, but there's no UI to view/manage bookmarks
- Add a fifth RightPanel tab, or a top-bar dropdown

## Priority 3 — Enhanced AI

### 3.1 AI-generated study outlines saved to notes
- The `/api/ai/outline` endpoint returns structured outlines
- Allow saving these directly as new notes (use the existing notes API)

### 3.2 Cross-reference map
- Visualize cross-references as a graph (verse → related verses)
- `/api/ai/cross-references` already returns them as text

### 3.3 Conversation history persistence
- Currently AI chat state is in-memory per-component and resets on chapter change
- Optional: persist conversation snapshots tied to a reference

## Priority 4 — Library & PDF

### 4.1 Production library readability
- `ingest/extract_pdf_pages.py` exists. Run it (one-time) wherever PDFs live, then ship the resulting `library_pages` rows
- Production then serves library content without PyMuPDF at runtime
- For the in-app reader UI, see 4.2

### 4.2 In-app library reader
- With pages pre-extracted, build a simple paginated reader component
- Link commentary/library cross-references to jump to relevant book sections
- Add FTS5 over `library_pages.text` for searchable library content

## Priority 5 — Infrastructure

### 5.1 Real multi-user auth
- `APP_PASSWORD` is shared-secret only. For multi-user with separate notes, swap in proper user accounts
- Would require user IDs on `notes`/`highlights`/`bookmarks`/`reading_plans` — meaningful migration

### 5.2 Offline / PWA
- Frontend can be made a PWA with service worker
- Cache current chapter + commentary for offline use
- React Query already de-dupes — relatively cheap to add

### 5.3 Postgres for user-mutable tables
- Bible/commentary/lexicon stay in SQLite (read-only, bulk content)
- User-mutable tables move to Postgres for multi-instance scale
- Not urgent until 5.1 lands or traffic actually requires it
