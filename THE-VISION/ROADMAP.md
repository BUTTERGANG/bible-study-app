# Roadmap

## Priority 1 — Complete Core Study Features

### 1.1 Greek/Hebrew Interlinear (High Value)
- Obtain STEPBible TSV data files (publicly available from STEPBible GitHub)
- Run `ingest/ingest_stepbible.py` to populate `greek_words` / `hebrew_words` tables
- The Word Study panel UI is already built — it just needs data
- Once populated: clicking any NT word shows Greek + Strong's number + morphology

### 1.2 Biblical Dictionary
- `dictionary_entries` table is empty
- Options: ingest from SWORD dictionary modules, or use existing lexicon data as fallback
- UI hookup in `api/client.js` already exists

### 1.3 Reading Plan UI
- Backend fully implemented (4 built-in plans + custom)
- No dedicated frontend panel exists yet — needs a new tab or modal
- Today's readings already available at `/api/reading-plans/today`

## Priority 2 — Frontend UX Improvements

### 2.1 Sidebar: Book navigation beyond chapter arrows
- Currently clicking a book in the sidebar needs to properly navigate
- Read `Sidebar.jsx` and wire up book-level navigation cleanly

### 2.2 Commentary source picker
- User should be able to select which commentary source(s) to show
- Currently defaults to all sources — can get verbose for popular verses

### 2.3 Translation compare view
- `/api/bible/compare/{book}/{chapter}/{verse}` already works
- Add a UI toggle to show multiple translations side-by-side for the current verse

### 2.4 Verse sharing / export
- Export a passage + notes as formatted text/markdown
- Share a reference link

## Priority 3 — Enhanced AI

### 3.1 Passage-aware AI context
- When asking AI a question, auto-include the currently visible chapter text
- Reduces need to manually paste verses

### 3.2 AI-generated study outlines saved to notes
- The `/api/ai/outline` endpoint returns structured outlines
- Allow saving these directly as structured notes

### 3.3 Cross-reference map
- Visualize cross-references as a graph (verse → related verses)
- `/api/ai/cross-references` already returns them as text

## Priority 4 — Library & PDF

### 4.1 Resolve PyMuPDF on Replit/Nix
- Option A: Add `pkgs.python311Packages.pymupdf` to `replit.nix` (if available)
- Option B: Use `pdfplumber` or `pypdf` as fallback
- Option C: Pre-extract PDF text to DB at ingest time (avoids runtime PDF dependency)

### 4.2 In-app library reader
- If PDF reading is resolved, build a simple paginated reader component
- Link commentary/library cross-references to jump to relevant book sections

## Priority 5 — Infrastructure

### 5.1 Multi-user support
- Currently all notes/highlights/bookmarks are single-user (no auth)
- Could add simple PIN/passphrase per session for family/group use

### 5.2 Persistent storage across Replit restarts
- SQLite `data/bible.db` is the primary store — should survive restarts
- Notes/highlights/bookmarks tables persist as-is (0 rows initially, grows with use)
- If Replit clears ephemeral storage: re-download `bible.db` from Google Drive

### 5.3 Offline / PWA
- Frontend can be made a PWA with service worker
- Cache current chapter + commentary for offline use
