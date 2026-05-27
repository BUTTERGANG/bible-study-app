# LOGOS Bible Study App — Comprehensive Review Report

**Date:** 2026-05-27  
**Scope:** All 6 sprints (58 features, ~313 points delivered)  
**Agents:** Security, Code Quality, Performance, Database, UI/UX, Dependencies  
**Total Findings:** 121 across all agents

---

## Executive Summary

| Agent | Files Read | Findings | Critical | High | Medium | Low |
|-------|-----------|----------|----------|------|--------|-----|
| Security | 20+ | 13 | 0 | 6 | 6 | 1 |
| Code Quality | 38 | 18 | 0 | 5 | 8 | 5 |
| Performance | 25+ | 20 | 0 | 7 | 7 | 6 |
| Database | 20+ | 20 | 2 | 7 | 6 | 5 |
| UI/UX | 25+ | 44 | 0 | 6 | 20 | 18 |
| Dependencies | 25+ | 26 | 0 | 3 | 11 | 12 |
| **Total** | **153+** | **141** | **2** | **34** | **58** | **47** |

### Fixes Applied (2026-05-27)

| # | Finding | Status | Fix Applied |
|---|---------|--------|-------------|
| 1 | `library_pages_fts` table never created | ✅ Fixed | Created migration `0005_library_pages_fts_and_fk_cascades.py` |
| 2 | FK columns lack `ondelete=CASCADE` + PRAGMAs | ✅ Fixed | Added cascades to 14+ FK columns; added WAL/pragma event listener in `database.py` |
| 3 | Missing auth on `POST /reading-plans/{id}/complete` | ✅ Fixed | Added `get_current_user` dep + ownership check in `reading_plans.py` |
| 4 | XSS via `dangerouslySetInnerHTML` | ✅ Fixed | Installed DOMPurify; sanitized all 4 `dangerouslySetInnerHTML` sites |
| 5 | Default JWT secret key | ✅ Fixed | Made `JWT_SECRET_KEY` required at runtime (lazy check in token functions) |
| 6 | Timing side-channel on login | ✅ Fixed | Always runs bcrypt hash even when user not found |
| 7 | IDOR in media file serving | ✅ Fixed | Added auth + ownership check to `serve_media` |
| 8 | Missing security headers | ✅ Fixed | Added `SecurityHeadersMiddleware` with CSP, X-Frame-Options, etc. |
| 9 | No rate limiting on auth endpoints | ✅ Fixed | Added `auth_rate_limit` (5/min, 30/hr) to register/login |
| 10 | SSE raw error messages leak internals | ✅ Fixed | Generic error message + server-side logging in `_stream_response` |
| 11 | Duplicate `getTodayReadings` in client.js | ✅ Fixed | Renamed to `getTodayPlanReadings`; updated caller |
| 12 | No pagination on prayer list | ✅ Fixed | Added `limit`/`offset` query params (default 50, max 200) |
| 13 | No result limit on commentary | ✅ Fixed | Added `MAX_COMMENTARY_ENTRIES = 500` limit |
| 14 | Offline sync has no retry limits | ✅ Fixed | Added `MAX_RETRIES = 3` with retry counter per queue entry |
| 15 | Toggle buttons lack `role="switch"` | ✅ Fixed | Added `role="switch"` + `aria-checked` to all toggles |
| 16 | Verse spans not keyboard accessible | ✅ Fixed | Added `role="button"`, `tabIndex={0}`, `onKeyDown` handler |
| 17 | Zustand full-store destructuring causes re-renders | ✅ Fixed | Converted 10+ components to use per-field selectors |
| 18 | GZip compression not enabled | ✅ Fixed | Added `GZipMiddleware` with 500-byte minimum |
| 19 | `greenlet` unpinned in requirements.txt | ✅ Fixed | Pinned to `greenlet==3.1.1` |
| 20 | Search `limit` params lack `ge=1` | ✅ Fixed | Added `ge=1` to both search endpoints |

### Top Priority Issues (Must Fix Before Next Sprint)

| # | Finding | Source | Severity | Impact |
|---|---------|--------|----------|--------|
| 1 | `library_pages_fts` table never created — library search & AI context broken | DB-001 | **Critical** | Features completely non-functional |
| 2 | FK columns lack `ondelete=CASCADE` + `PRAGMA foreign_keys` never enabled | DB-002 | **Critical** | Data integrity violations possible |
| 3 | Missing auth on `POST /reading-plans/{id}/complete` (unauth progress tampering) | SEC-001 | High | Any user can modify any plan |
| 4 | XSS via `dangerouslySetInnerHTML` on AI-generated content (no sanitization) | SEC-002 | High | Arbitrary JS execution via prompt injection |
| 5 | Default JWT secret key in production | SEC-004 | High | Full account takeover if env var not set |
| 6 | Media files served without auth (IDOR via URL) | SEC-006 | High | Access other users' uploaded files |
| 7 | Missing WAL mode, `PRAGMA foreign_keys`, `busy_timeout` | DB-003/PERF-001 | High | DB locks under concurrency, no FK enforcement |
| 8 | Duplicate `getTodayReadings` in API client (silent override bug) | CODE-006 | High | Reading-plan "today" unreachable |
| 9 | No SQLite WAL mode or pragmas | PERF-001 | High | Entire DB locks on writes |
| 10 | react-leaflet v5 installed (requires React 19, project on React 18) | DEP-001 | High | Potential runtime crashes |

---

## Security Review (13 findings)

### High (6)

**SEC-001: Missing Authentication on Reading Completion Endpoint**  
`POST /api/reading-plans/{plan_id}/complete` has no auth dependency and no ownership check. Any unauthenticated caller can mark readings complete for any plan ID.
```python
# Add to reading_plans.py:
user: CurrentUser = Depends(get_current_user),
# + ownership check before update
```

**SEC-002: XSS via `dangerouslySetInnerHTML` with AI Content**  
`CulturalContextPanel.jsx:64` and `InsightsPanel.jsx:307` render AI-generated notes via `dangerouslySetInnerHTML` with only a `**bold**` regex replacement — no HTML sanitization. A compromised AI response with `<img onerror>` or `<script>` executes arbitrary JavaScript.  
**Fix:** Add DOMPurify with an allowlist of `strong`, `br`, `em`, `p`, `ul`, `ol`, `li`, `a`.

**SEC-003: XSS via FTS Snippets in Library Reader**  
`LibraryReader.jsx:564` renders `result.snippet` (FTS5 output) via `dangerouslySetInnerHTML`. If ingested PDF content contains HTML tags, they're rendered as-is.  
**Fix:** Sanitize snippets server-side or with DOMPurify (allowing only `<mark>` tags).

**SEC-004: Default JWT Secret Key**  
`auth.py:22` falls back to `"dev-change-this-in-production-please"`. If deployed without `JWT_SECRET_KEY`, attackers can forge any user's token.  
**Fix:** Hard-fail at startup if not set in production.

**SEC-005: Timing Side-Channel in Login**  
`users.py:61-69` short-circuits on missing user (no bcrypt call), allowing email enumeration via timing differences.  
**Fix:** Always run a dummy hash for non-existent users.

**SEC-006: Media Files Served Without Auth**  
`media.py:146-167` — `GET /api/media/file/{user_id}/{filename}` is publicly accessible. Predictable URL pattern (`/{user_id}/{YYYYMMDD}_{uuid}{ext}`).  
**Fix:** Add auth + ownership check.

### Medium (6)

- **SEC-007:** No rate limiting on `/register` and `/login` endpoints
- **SEC-008:** No security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS)
- **SEC-009:** SSE streams send raw exception messages (leaks internal paths/keys)
- **SEC-010:** No `max_length` on user content fields (notes, prayers, sermons)
- **SEC-011:** APP_PASSWORD compared with `==` instead of `hmac.compare_digest`
- **SEC-012:** AI rate limiter only keys on IP, blindly trusts `X-Forwarded-For`

### Positive Security Observations

1. All DB queries use SQLAlchemy parameterized queries — no SQL injection
2. bcrypt for password hashing
3. Proper JWT with type validation, expiration, active-user checks
4. File uploads validate content type, extension, magic bytes, enforce UUID filenames, 5MB limit
5. Most endpoints correctly filter by `user_id == current_user.id`
6. AI chat uses `rehype-sanitize` with ReactMarkdown
7. No `eval`, `exec`, `subprocess`, `pickle`, or unsafe deserialization anywhere
8. CORS driven from env var, defaults to localhost only

---

## Database Review (20 findings)

### Critical (2)

**DB-001: Missing `library_pages_fts` Virtual Table**  
Both `library.py:177` and `ai.py:134` query `library_pages_fts` via FTS5, but this table is never created — no migration, no `CREATE VIRTUAL TABLE` in `init_db()`, no startup check. **Library search and AI library context are completely broken.**  
**Fix:** Add migration `0005` to create the virtual table and populate it from `library_pages`.

**DB-002: Foreign Keys Have No `ondelete` Action**  
Almost all FK columns omit `ondelete="CASCADE"` — child rows aren't cleaned up at the DB level when parents are deleted. Only `StudySection.project_id` has it. Combined with DB-009 (PRAGMA foreign_keys never enabled), the database has zero referential integrity enforcement.

### High (7)

- **DB-003:** No WAL mode, no `PRAGMA foreign_keys=ON`, no `busy_timeout` — DB locks under concurrent access
- **DB-004:** `complete_reading` endpoint missing `user_id` check (any authenticated user modifies any plan)
- **DB-005:** `Highlight.translation` column missing standalone index
- **DB-006:** `LexiconEntry` missing composite index on `(strongs_num, source)` for lemma joins
- **DB-007:** All migration `downgrade()` functions are no-ops — no rollback path
- **DB-008:** `sources` parameter not passed through to FTS commentary search query

### Medium (6)

- **DB-009:** `PRAGMA foreign_keys = ON` never executed (SQLite FK enforcement disabled)
- **DB-010:** `list_prayers` has no pagination
- **DB-011:** `list_media` has no pagination
- **DB-012:** `complete_reading` doesn't verify ownership even with auth
- **DB-013:** Migration chain produces different constraint history than `init_db()`
- **DB-014:** `LexiconEntry`/`DictionaryEntry` missing unique constraints (duplicate ingestion risk)

---

## Code Quality Review (18 findings)

### High (5)

**CODE-003: God Components (>500 lines)**  
- `NotesPanel.jsx` — 750 lines (CRUD + media + markdown + tags + AI)
- `LibraryReader.jsx` — 577 lines (browser + reader + search + summary)
- `MorphSearchModal.jsx` — 548 lines (morphology filter + results)
- `ReadingPlansPanel.jsx` — 548 lines (listing + detail + today + AI creation)

**CODE-006: Duplicate `getTodayReadings` in API Client**  
`client.js:138,227` — the second definition silently overrides the first. Reading-plan "today" endpoint is unreachable.
```js
// Rename to:
getReadingPlanToday: () => get('/reading-plans/today'),
getLectionaryToday: () => get('/lectionary/today'),
```

**CODE-007: `ai.py` Router is 943 Lines**  
10+ distinct AI endpoints, all prompt templates, caching, and a markdown parser in one file.  
**Fix:** Split into `ai/ask.py`, `ai/sermon.py`, `ai/insights.py`, `ai/summarize.py`, `ai/prompts.py`.

**CODE-008: `search.py` Router is 557 Lines**  
FTS, semantic search, theme maps, Greek/Hebrew morphology, snippet generation — all in one file.  
**Fix:** Split into `search/fts.py`, `search/semantic.py`, `search/morphology.py`.

**CODE-011: Zero PropTypes**  
No component has PropTypes or TypeScript. Forty-seven components, 3 stores, 5 hooks, 11+ API modules — no type safety anywhere.

### Medium (8)

- **CODE-001:** TopBar destructures 18 store items — bottleneck for new UI state
- **CODE-005:** Inconsistent HTTP status codes for create/delete across routers
- **CODE-009:** Inline styles and module-level CSS class strings instead of Tailwind `@apply`
- **CODE-010:** Inconsistent response shapes across list endpoints
- **CODE-012:** NotesPanel has 15 `useState` calls, nested `MediaPickerModal`
- **CODE-013:** `useUrlSync` bidirectional sync lacks re-entrancy guard
- **CODE-014:** Offline sync has no retry limit or backoff (`retries` field never read)
- **CODE-015:** No global unhandled promise rejection handler

---

## Performance Review (20 findings)

### High (7)

**PERF-001: No SQLite WAL Mode or Performance Pragmas**  
Identical to DB-003. `database.py:19` creates engine with bare defaults. Every write locks the entire 2.24GB database.  
**Fix:** Add `PRAGMA journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `cache_size=-64000`.

**PERF-002: Dashboard Makes 7 Sequential DB Queries**  
`dashboard.py:157-172` — VOTD, active plan, today's readings, completed count, total days, completed days, reflection check — all sequential.  
**Fix:** Use `asyncio.gather()` for parallel queries, combine counts into aggregation.

**PERF-003: Zero `React.memo` Usage**  
None of 46 components use `React.memo()`. Any Zustand store change re-renders every subscribing component. `BibleReader` destructores 10 store values.  
**Fix:** Memoize `VerseText`, `InterlinearVerse`, use Zustand selectors.

**PERF-004: BibleReader Fetches 3 Separate Chapter Queries**  
When interlinear is enabled: `getChapter` + `getChapterInterlinear` + `getChapterLemmas` — 3 full chapter fetches.  
**Fix:** Combine into single endpoint with `?include=interlinear,lemmas`.

**PERF-005: Zustand Store Subscriptions Cause Cascade Re-renders**  
Components destructure entire store instead of selecting individual slices.  
**Fix:** Use `useStudyStore(s => s.book)` selector pattern.

**PERF-006: Per-Verse Filter Computation for 700-Verse Chapters**  
`InterlinearVerse.jsx:36` computes `activeFilterSet` for every verse in the chapter. Psalm 119 = 700 computations.  
**Fix:** Lift computation to `BibleReader` and pass down; memoize `InterlinearVerse`.

**PERF-007: No Pagination on Notes, Highlights, Commentary**  
Highlights fetches ALL for a chapter/user. Commentary fetches ALL for a verse across all sources.

### Medium (7)

- **PERF-008:** Google Fonts missing preconnect to `fonts.gstatic.com`
- **PERF-009:** streamAI retry logic discards partial responses and leaks memory
- **PERF-010:** `useStreamingAI` builds history inside `setMessages` callback
- **PERF-011:** Offline sync opens/closes IndexedDB on every queue operation
- **PERF-012:** RightPanel's 27 lazy components share single Suspense boundary
- **PERF-013:** Commentary endpoint has no result limit
- **PERF-014:** `resolve_translation` makes a DB query per request (not cached)

---

## UI/UX Review (44 findings)

### High (6)

**A11Y-001: Zero ARIA Attributes**  
The entire codebase has **zero ARIA attributes** — no `aria-label`, `aria-expanded`, `role`, or semantic annotations. Screen readers receive no information about any interactive element. Every icon-only button needs `aria-label`.

**A11Y-002: No Keyboard Focus Management in Modals**  
`ShareCardModal.jsx:108`, `MemorizePanel.jsx:28`, `NotesPanel.jsx:119` — no focus trapping. Keyboard users can't navigate overlays.

**A11Y-003: Missing ESC Key Handling**  
Only `SearchModal` and `MorphSearchModal` handle ESC to close. `ShareCardModal`, quiz card, and image viewer require clicking X or backdrop.

**A11Y-004: Clickable `<span>` Verses Not Keyboard Accessible**  
`VerseText.jsx:50` renders verses as `<span onClick>` — not focusable, no button semantics, keyboard users can't select or interact with verses.

**CON-001/CON-002: TopBar and SyncStatus Lack Dark Mode**  
Both components use hardcoded `slate-` colors with **zero `dark:` prefix classes**. They look broken in light mode and vice versa.

### Medium (20)

- **A11Y-005:** Clickable `<div>` elements in Sidebar/BookIntroCard lack keyboard support
- **A11Y-006:** `window.confirm()` used for destructive actions (3 files) — no undo, no dark mode
- **A11Y-010:** Notification toggles lack `role="switch"` + `aria-checked`
- **A11Y-012:** 28-tab RightPanel has no ARIA tabs pattern or keyboard navigation
- **A11Y-016:** Leaflet map markers are inaccessible custom SVGs
- **UX-001:** Form submissions lack loading spinners for slow AI operations
- **UX-004:** RightPanel tab bar has no overflow indicator for 28 tabs
- **UX-007:** Delete actions use `window.confirm` with no undo capability
- **UX-011:** Disabled notification toggles still show active time inputs

---

## Dependency Review (26 findings)

### High (3)

**DEP-001: react-leaflet v5 Installed (Requires React 19, Project on React 18)**  
`package.json` declares `^4.2.1` but `package-lock.json` resolved to `5.0.0`, which requires React 19. Installed silently in non-strict peer-dep mode. May cause runtime crashes.  
**Fix:** Pin to `4.2.1` exactly and reinstall.

**DEP-017: Python `greenlet` Unpinned**  
Only Python dependency without a version constraint. Transitive dep of SQLAlchemy for async ops. Different installs could pull breaking versions.  
**Fix:** Pin: `greenlet==3.5.1`.

**DEP-010+DEP-011: `requirements.txt` Doesn't Match Installed Environment**  
FastAPI declared 0.115.0, installed 0.136.1. Anthropic declared 0.37.1, installed 0.104.0. The lock file doesn't represent the running state.  
**Fix:** Run `pip freeze > requirements-lock.txt`; consider pip-tools or Poetry.

### Medium (11)

- **DEP-004:** Vite v5 behind latest v8 (dev-server CVEs: GHSA-4w7w-66w2-5vf9, GHSA-67mh-4wv8-2f99)
- **DEP-005:** Tailwind CSS v3 behind v4 (major rewrite)
- **DEP-006:** React Router DOM v6 behind v7
- **DEP-009:** PyMuPDF 1.24.11 behind 1.27.2 (PDF parsing security)
- **DEP-018:** No Python lock file (requirements.txt not reproducible)
- **DEP-025:** Node.js mismatch: replit.nix specifies v20, runtime is v26
- **DEP-026:** Python mismatch: replit.nix specifies 3.11, venv runs 3.14.5

---

## Consolidated Action Plan

### Immediate (This Week — 2-3 hours total)

| # | Action | Effort | Blocks |
|---|--------|--------|--------|
| 1 | Create `library_pages_fts` migration (DB-001) | 30 min | Library search, AI context |
| 2 | Add auth to `complete_reading` endpoint (SEC-001/DB-004) | 15 min | Data integrity |
| 3 | Add `ondelete=CASCADE` + `PRAGMA foreign_keys=ON` (DB-002/DB-003/DB-009/PERF-001) | 45 min | Data integrity, concurrency |
| 4 | Fix duplicate `getTodayReadings` in `client.js` (CODE-006) | 5 min | Reading plan feature |
| 5 | Pin react-leaflet to v4.2.1 (DEP-001) | 10 min | Runtime stability |
| 6 | Generate Python lock file (DEP-018) | 5 min | Reproducibility |
| **Total** | | **~2 hours** | |

### High Priority (Next Sprint)

| # | Action |
|---|--------|
| 1 | Add DOMPurify to all `dangerouslySetInnerHTML` sites (SEC-002/SEC-003) |
| 2 | Make JWT_SECRET_KEY required at startup (SEC-004) |
| 3 | Add auth to media file serving (SEC-006) |
| 4 | Add security headers middleware (SEC-008) |
| 5 | Add rate limiting to auth endpoints (SEC-007) |
| 6 | Add `React.memo` to VerseText + Zustand selectors (PERF-003/PERF-005) |
| 7 | Cache `resolve_translation` (PERF-014) |
| 8 | Add pagination to prayers and media list (DB-010/DB-011) |
| 9 | Add ARIA attributes to all icon buttons and toggles (A11Y-001) |
| 10 | Create shared Modal component with focus trapping + ESC (A11Y-002/A11Y-003) |
| 11 | Fix TopBar/SyncStatus dark mode (CON-001/CON-002) |
| 12 | Split `ai.py` and `search.py` into sub-modules (CODE-007/CODE-008) |

### Medium Priority (Backlog)

- Upgrade Vite to 6.x (fixes dev-server CVEs)
- Migrate Tailwind CSS to v4
- Add GZip middleware to FastAPI
- Add PropTypes/TypeScript to shared components
- Migrate `useUrlSync` with re-entrancy guard
- Add retry limits and backoff to offline sync
- Replace `window.confirm` with styled dialogs + undo
- Add global unhandled rejection handler
- Standardize HTTP status codes across routers
- Standardize list response shapes across routers
- Add skip-navigation link for keyboard users
- Make verses keyboard-accessible (button semantics)
- Preload common RightPanel tabs
- Add `@font-face` preconnect to gstatic

---

## What the App Does Well

### Architecture
- **Excellent code splitting** — 38 lazy-loaded JS chunks; RightPanel's 27 lazy components on demand
- **Proper async SQLAlchemy** with `aiosqlite` — no blocking the event loop
- **FTS5 search** with graceful LIKE fallback
- **Offline-first architecture** — IndexedDB queue with conflict detection, PWA SW caching
- **AI prompt caching** with Anthropic `cache_control` (reduces token costs)
- **Rate limiting** on AI endpoints prevents budget exhaustion
- **Normalized reading plan storage** — JSON blob to proper relational table

### Security
- SQL injection prevention via SQLAlchemy parameterized queries throughout
- bcrypt password hashing
- Proper JWT with type validation, expiration, active-user verification
- File uploads validate content type, extension, magic bytes, enforce UUID filenames, 5MB limit
- Most endpoints correctly enforce `user_id == current_user.id`
- No `eval`, `exec`, `subprocess`, `pickle`, or unsafe deserialization anywhere
- CORS driven from environment variable

### Database
- Clean SQLAlchemy 2.0 `Mapped` annotations
- Good composite indexes on BibleVerse and GreekWord/HebrewWord
- Proper `selectinload` for eager loading (sermons, study projects)
- Idempotent migrations with `_has_table()` / `_has_column()` guards
- `render_as_batch=True` for SQLite compatibility
- Batch verse text queries in NT-OT connections

---

*Report generated by 6 parallel review agents reading 153+ source files*
