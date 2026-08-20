# Roadmap

Last updated: 2026-06-11

> **See also**: `FEATURE-GAPS.md` for a Logos Bible Software comparison and gap analysis.

---

## Recently Shipped

### 2026-08-20 — Product quality and accessibility pass

- Added shared panel primitives for consistent headers, states, sections, and actions.
- Simplified study-panel navigation into Scripture, Study, Resources, Personal, and Ministry categories.
- Added reader-first loading/error states and calmer editorial surfaces.
- Added focus trapping, Escape handling, focus restoration, reduced-motion support, and mobile keyboard focus states across the highest-use overlays and navigation.
- Verified 160 backend tests, ruff, ESLint, Vite build, and Alembic head `0022`.

### 2026-06-11 — Reconciliation: fix branch merged, gates green, migrations linearized

Ported the genuine fixes from the long-dormant `fix/audit-bugs-lint-docs`
branch onto current main and drove all verification gates to clean:

- **Backend fixes**: lemma-endpoint NameError (was crashing every `/lemmas`
  call), SPA path-traversal guard in `serve_spa`, `create_note` now validates
  the Bible book (400 on unknown book, matching `list_notes`).
- **Frontend fixes**: AIAssistant streaming ReferenceError, BibleBrowser
  stale-closure in keyboard-nav, undefined `ROUTE_COLORS_LEGEND` in MapPanel.
- **Lint**: ruff `backend`+`ingest` 283 → 0; ESLint `--max-warnings 0` clean
  (dead-code/hook-deps sweep); Vite build clean.
- **Alembic**: linearized the migration chain 0001–0022 (was multi-head —
  `alembic upgrade head` failed outright on duplicate revision ids).
- **Tests**: 160 passed (backend/tests, 19 files).



### 2026-06-04 — Comprehensive Audit & Hardening

Full swarm audit (8 parallel agents) followed by systematic fixes across security, performance, code quality, accessibility, and test coverage.

#### Runtime Crashes Fixed (were 100% failure rate)
- `groups.py` — `NameError: g` — group creation crashed on every request
- `bible.py` — `IndexError` on dict unpack — entire interlinear feature broken
- `DashboardPanel` + `GospelHarmony` — `setBook`/`setChapter` don't exist on store → `setReference`
- `SermonBuilder` — `useQueryClient()` called inside event handler (React hooks violation)
- `reading_plans.py` — missing `timezone` import caused `NameError` on `complete_reading`

#### Security
- **passlib → pwdlib** — eliminates silent breakage with bcrypt 4.x
- **SVG removed from media upload** — was allowing stored XSS via `<script>` in SVG files
- **JWT refresh endpoint** — now rate-limited + issues a new refresh token on use (rotation)
- **Rate limiter IP spoofing fix** — uses rightmost `X-Forwarded-For` hop (was attacker-controlled first hop)
- **Auth/AI rate limit buckets separated** — were sharing counters, causing cross-interference
- **SSE error streams** no longer leak `str(e)` (internal SDK messages, file paths)
- **Path traversal guard** on media file serve (`.resolve()` + prefix check)
- **JWT minimum length** enforced at startup (32 chars for HS256 security)
- **HSTS header** added when `DEPLOYMENT_ENV=production`
- **`.env.example`** now includes `JWT_SECRET_KEY` with generation instructions + open-mode warning

#### Dependencies (CVEs patched)
- `python-jose` 3.3.0 → 3.5.0 (CRITICAL algorithm confusion + 3 additional CVEs)
- `python-multipart` 0.0.12 → 0.0.30 (3 HIGH CVEs)
- `uvicorn` → 0.49.0, `dompurify` → 3.4.8 (9 XSS bypass CVEs)
- `react-router-dom` → 6.30.4 (open redirect), `vitest` → 4.1.0 (CRITICAL arbitrary file read)
- `pymupdf` → `pypdf` (MIT license — eliminates AGPL obligation on networked deployments)
- `passlib[bcrypt]` → `pwdlib[bcrypt]` (actively maintained, works with bcrypt 4.x+)

#### Performance
- **N+1 eliminated** in group feed (51 queries → 3 bulk IN queries) and lexicon semantic range (10 serial → 1 window query)
- **`VerseText` + `InterlinearVerse`** wrapped in `React.memo` — prevents full-chapter re-render on unrelated state changes
- **`BibleReader` + `TopBar`** switched to per-field Zustand selectors (was subscribing to full store)
- **`html2canvas`** → dynamic import — removed from initial bundle (~90KB saving)
- **`resolve_translation`** module-level cache — eliminates DB query per Bible chapter request
- **`asyncio.gather`** for dashboard parallel queries (was sequential)
- **`Cache-Control: public, max-age=86400`** on immutable Bible chapter/verse endpoints
- **SQLite** `cache_size` 64MB → 256MB, `mmap_size` 512MB added

#### Database
- **Migration 0009** — composite indexes (`notes`, `highlights`, `reading_plan_days`) + FTS5 sync triggers for `library_pages` (new pages now searchable)
- **Migration 0010** — batch-rebuilds 18 user-data tables with correct `ON DELETE CASCADE` DDL (was `NO ACTION` causing user deletion to fail)
- **Migration 0008** — fixed inverted index guard (`plan_type` index was never created)
- **`complete_reading`** — SQLite upsert (`ON CONFLICT DO UPDATE`) to fix TOCTOU race condition

#### Code Quality
- **JWT auto-refresh interceptor** in `client.js` — 401 responses silently refresh the token and retry (was silently failing after 15-min access token expiry)
- **`useStreamingAI`** — moved `streamAI()` call outside `setMessages` updater (was double-invoking in React StrictMode)
- **`useClickOutside` hook** extracted — was duplicated as inline `mousedown` `useEffect` in 5 components
- **`useOfflineSync`** — module-level `_flushing` flag (was per-instance, causing race between `App.jsx` and `SyncStatus.jsx`)
- **Offline sync** now invalidates React Query cache for affected query keys after replay
- **`aiHistory`** capped to 10 most-recent keys in localStorage (was unbounded, causing 500KB+ serialization pauses)
- **`groupsStore`** — added named export (named imports were silently `undefined` in 3 components)
- **`window.confirm`** replaced with inline two-step confirm UI in GroupDetail, ReadingPlansPanel, SermonBuilder
- **`datetime.utcnow()`** → `datetime.now(timezone.utc)` throughout (deprecated in Python 3.12)
- **Pydantic response models** added to 8 routers: `notes`, `highlights`, `bookmarks`, `memorize`, `prayer`, `ai_conversations`, `media`, `study_projects` — free OpenAPI schemas, removed ~8 hand-rolled serializer helpers

#### Accessibility
- **All 4 modals** — `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, auto-focus on first input on open
- **RightPanel 30-tab bar** — `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`
- **TopBar toggles** — `aria-pressed` on Interlinear, Compare, and Show Lemmas buttons

#### Mobile Responsive Layout
- **Sidebar** — fixed slide-in drawer overlay below `md` (768px) breakpoint with tap-outside backdrop
- **Right panel** — fixed bottom sheet (`h-[80vh]`, rounded top) below `md` breakpoint with tap-outside backdrop
- Desktop three-column layout unchanged; no new dependencies

#### Tests (new files)
- `test_users.py` — register, login, wrong password, duplicate email, `/me`, refresh token
- `test_groups.py` — create group, cross-user isolation, owner vs. non-owner ACL, delete
- `test_highlights.py` — CRUD + multi-user isolation
- `test_media.py` — valid JPEG, SVG rejection (415), oversized (413), invalid magic bytes

---

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
- 246 books catalogued; `library_pages` FTS5 table ready but empty; FTS5 sync triggers now in place (migration 0009)
- Fix: run `python -m ingest.extract_pdf_pages` on a host with the PDFs
- Unlocks: in-app library reader + FTS library search

### P2 — Audio

**Audio backend for AudioPlayer**
- `AudioPlayer` component exists in the frontend
- Need: audio file serving endpoint + Bible audio source

### P3 — Infrastructure

**Expand test coverage**
- Auth, highlights, groups, media, notes, shares, streaks, tags, courses, sermons, sermon series, and search/morph/clause-syntax now covered (19 files / 160 tests, 2026-06-11)
- Still uncovered: AI conversations, doctrine, lectionary, reading plans, lexicon, dashboard

**Remaining overlay accessibility audit**
- Focus trap, Escape handling, focus restoration, and accessible labels now cover Search, Morphological/Clause Search, Create Group, and Memorize quiz.
- Remaining: audit custom overlays, drawers, and bottom sheets for the same behavior.

**`python-jose` → `PyJWT` migration**
- `python-jose` patched to 3.5.0; long-term prefer `PyJWT>=2.4.0` (better maintained)
- Only 3 call sites in `auth.py`

**Postgres for user-mutable tables** (not urgent)
- Bible/commentary/lexicon stay in SQLite; user-mutable tables move to Postgres for multi-instance scale
- Not urgent until real multi-user traffic requires it
