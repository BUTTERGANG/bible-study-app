# Roadmap

Last updated: 2026-06-02

> **See also**: `FEATURE-GAPS.md` for a Logos Bible Software comparison and gap analysis.

---

## Recently Shipped

### 2026-06-02 — Data Reingest, Bug Fixes & Cross-Reference UI

#### Data
- **TSK cross-references re-ingested** (`ingest/reingest_tsk.py`) — previous data was corrupted keyword fragments ("God.gave.that whosoever."); now properly parses SWORD ThML `<scripRef>` tags and stores real verse citations ("Luke 2:14; Romans 5:8; Genesis 22:12; …") — 28,892 entries across all 66 books
- **Dictionary populated** (`ingest/reingest_dictionaries.py`) — 85,664 entries from 5 SWORD modules: Easton (3,963), ISBE (9,349), Smith (4,639), Nave (5,322), Webster 1828 (62,391); fixed two parser bugs (8-byte zdx records, CRLF key termination)
- **Factbook seeded** (`ingest/seed_factbook.py`) — 119 pre-cached entries (43 people, 27 places, 30 themes, 19 events) sourced from Easton/ISBE so the panel works without an AI key
- **Reading plans expanded** — `BUILT_IN_PLANS` now covers all 101 templates (was 4); generic chapter scheduler auto-distributes any book list across any duration

#### Bug Fixes
- **Lectionary date picker stuck** — removed `useEffect` that snapped `selectedDate` back to `matched_date` on every calendar pick; picker now holds the user's chosen date
- **Cross-reference numbered books** — regex updated to capture `1 Cor`, `2 Ki`, `1 Sam` etc. (was anchored to `[A-Z]`, missing digit-prefixed books in graph and list links)
- **Gospel Harmony 0 verses** — refs in `gospel_harmony.json` are stored as `"1:26-38"` (no book); fix prepends the gospel name before parsing so verses load correctly
- **Cultural notes 500 error** — missing `logger` import caused crash on every request; added `logging` import + logger instance
- **Factbook 500 on cached entries** — SQLite returns naive datetimes; `datetime.now(timezone.utc) - entry.generated_at` raised `TypeError`; fix makes comparison timezone-safe

#### Cross-Reference Panel Redesign
- **OT/NT pill chips** — replaced accordion + text-blob list with flat colored chip groups (blue = NT, violet = OT); all refs visible immediately with no expand clicks
- **Verse peek panel** — hover any chip to see the verse text inline without navigating; fetches via `api.getVerse` with React Query caching; includes "Open" button to navigate
- **Polished graph view** — two-line node labels (book name + ch:v for readability), hover highlights matching testament color, cleaner integrated legend with actual counts
- **View toggle always visible** — toggle no longer hidden until data loads (was causing layout shift)

### 2026-06-02 — Earlier
- **Lectionary `dateInputRef` fix** — removed stray ref that crashed the Lectionary panel render
- **Node.js / GLIBCXX fix** — `start.sh` now selects gcc-13+ lib (GLIBCXX ≥ 3.4.32) so the frontend build succeeds under Node.js 20

### 2026-05-29 — Sprint 7 + Polish
- **Bible Browser** (`/browse` full-screen route) — testament tabs, book groups, grid/list toggle, search filter, recently visited strip, chapter picker, jump-to-verse
- **Print / PDF export** — styled print window with verse text, highlights, and notes; `@media print` CSS; "Print / PDF" in verse context menu
- **HEAD request support** — preview / link-unfurling tools can probe the server without fetching a full response
- **Embedding-friendly headers** — removed `X-Frame-Options: DENY` and aggressive cache-control headers for embed/preview use cases
- **Service worker crash fix** — SW no longer crashes when it receives an HTML response it can't parse as JSON

### 2026-05-29 — Groups & Collaboration
- **Full-stack Groups system** — 5 new DB models (Group, GroupMember, GroupInvite, GroupNote, GroupSharedItem), migration 0006, 17 new API endpoints
- **GroupsPanel** — right-panel tab: group list, pending invites, activity feed
- **CreateGroupModal** + **GroupDetail** (Feed/Notes/Members/Settings tabs)
- **GroupNoteEditor** + **InviteManager** (email-based invitations with auto-add if user exists)
- **ShareToGroupButton** — share personal highlights/notes into groups
- **TopBar** user profile display + sign-out dropdown + pending invitations badge

### 2026-05-27 — Security Audit + Offline Sync
- **Security hardening** — DOMPurify on all `dangerouslySetInnerHTML`, auth + ownership checks on reading plan + media endpoints (IDOR), `JWT_SECRET_KEY` required at startup, timing-safe APP_PASSWORD comparison, auth rate limiter (5/min 30/hr), sanitized SSE error messages, `SecurityHeadersMiddleware`, `GZipMiddleware`
- **Migration 0005** — FTS5 on `library_pages` + CASCADE on 14+ FK columns
- **Offline mutation queue** — `useOfflineSync` hook, IndexedDB queue auto-flushes on reconnect
- **SyncStatus** component in TopBar — online/offline/syncing/conflict indicator with badge count

### 2026-05-26 — Sprint 5–7 Features
- **Cultural Context Notes** — AI-generated cultural notes panel + `/api/cultural-notes` endpoint
- **Passage Comparison View** — side-by-side translation compare with sync scroll and word diff
- **Study button** in TopBar + Quick Actions in Sidebar for discoverability
- **Lemma inline display** — toggle, popup, per-verse lazy loading in BibleReader
- **AI resource summarizer** — "Summarize" button in LibraryReader
- **Inline media in notes** — image upload, markdown rendering, lightbox
- **Fuzzy Bible search** — client-side reference parsing with did-you-mean suggestions
- **Discussion questions generator** — in StudyBuilder

### 2026-05-21 — Dark Mode + Polish
- Dark mode flash prevention, MapPanel dark-mode variants, print styles
- RightPanel: NotificationSettings panel, TopBar audio controls

### 2026-05-16 — Sprint 4 (Insights, Study Builder, etc.)
- Insights sidebar (AI passage insights), Study Builder (outlines, discussion questions), Memorization panel, Prayer Journal, Dashboard, Sharing cards, Book introductions
- Sermon Builder (audience-targeted AI), Cross-reference graph, Library AI context, Reverse interlinear

### 2026-05-15 — Sprint 2–3 + Foundation
- Topical Search panel, Library reader + AI summarizer, PWA service worker, offline support
- AI conversation history persisted per reference (book/chapter)
- Passage Guide unified view (commentary + word study + cross-refs)
- AI outline generation saved to notes
- Backend refactored to Python package; URL-canonical navigation; Alembic migrations; JWT auth; prompt caching

---

## Remaining Gaps

### P0 — Unlock AI Features

**Add ANTHROPIC_API_KEY to Replit Secrets**
- Zero effort — Replit → Tools → Secrets → Add `ANTHROPIC_API_KEY`
- Unlocks: AI assistant, explain/outline/insights, cultural notes, book intros, doctrine, factbook generation, sermon builder, study builder, AI reading plans, dashboard reflection

### P1 — Data

**Re-ingest full Strong's lexicon**
- `lexicon_entries` has 726 Dodson entries; `StrongsGreek` + `StrongsHebrew` SWORD modules needed
- Fix: run `ingest/ingest_sword.py` targeting those modules (CrossWire download available)
- Unlocks: full Strong's definitions in Word Study panel

**Extract library PDF pages**
- 246 books catalogued; `library_pages` FTS5 table ready but empty
- Fix: run `python -m ingest.extract_pdf_pages` on a host with the PDFs
- Unlocks: in-app library reader + FTS library search

### P2 — Audio

**Audio backend for AudioPlayer**
- `AudioPlayer` component exists in the frontend
- Need: audio file serving endpoint + Bible audio source

### P3 — Infrastructure

**Automated test coverage**
- Tests cover core Bible paths; Groups, AI conversations, media, doctrine, and lectionary routers lack coverage

**Postgres for user-mutable tables** (not urgent)
- Bible/commentary/lexicon stay in SQLite; user-mutable tables move to Postgres for multi-instance scale
- Not urgent until real multi-user traffic requires it
