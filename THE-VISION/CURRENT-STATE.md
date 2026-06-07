# Current State of Development

Last updated: 2026-06-04

## What Works

### Database (data/bible.db)
- **Bible text**: 394,338 verses across 13 translations (KJV, ASV, YLT, BSB, Darby, LEB, NETfree, NHEB, OEB, Rotherham, Webster, Wycliffe, KJVA)
- **Full-text search**: FTS5 indexes on `bible_verses`, `commentary_entries`, and `library_pages`
- **Commentary**: 539,318 entries from 15 sources (TSK, Clarke, Luther, KD, MHCC, Wesley, JFB, MHC, Geneva, Barnes, RWP, Burkitt, PNT, Lightfoot, TDavid)
- **TSK cross-references**: 28,892 entries — properly re-ingested from SWORD ThML `<scripRef>` tags (see `ingest/reingest_tsk.py`); previous data was corrupted keyword fragments
- **Dictionary**: 85,664 entries across 5 sources — Easton (3,963), ISBE (9,349), Smith (4,639), Nave (5,322), Webster 1828 (62,391); re-ingested 2026-06-02 (see `ingest/reingest_dictionaries.py`)
- **Factbook**: 119 pre-seeded entries (43 people, 27 places, 30 themes, 19 events) sourced from Easton/ISBE; additional entries AI-generated on demand (see `ingest/seed_factbook.py`)
- **Lexicon**: 726 clean Dodson Greek entries (re-ingest needed for full Strong's — see Known Gaps)
- **Greek interlinear**: 137,442 words — full NT (STEPBible TAGNT)
- **Hebrew interlinear**: 264,529 words — full OT (STEPBible TAHOT)
- **Library catalog**: 246 books catalogued; `library_pages` FTS5 table ready (pages must be extracted per DATA.md)
- **User accounts**: Full multi-user auth with JWT (`users` table via migration 0002)
- **AI conversations**: Persisted per-reference (`ai_conversations` table via migration 0003)
- **Media files**: Image upload + serving (`media_files` table via migration 0004)
- **Groups**: Collaborative study groups (`groups`, `group_members`, `group_invites`, `group_notes`, `group_shared_items` via migration 0006)
- **Doctrine entries**: Doctrine/systematic theology table (migration 0007)
- **Reading plans**: Extended with type, goal, day labels, and descriptions (migrations 0008–0009)

### Backend — 35+ API routers, proper Python package
Located in `backend/`, importable as `backend.main:app`. Launch with
`python -m uvicorn backend.main:app`.

Routers:
- `health.py` — `/api/health`, `/api/auth/status`
- `users.py` — register, login, profile (JWT auth)
- `bible.py` — chapter/verse retrieval, translation list, compare
- `commentary.py` — verse + chapter commentary, multi-source
- `search.py` — FTS5 across Bible + commentary + library (detected at startup)
- `notes.py` — verse/chapter notes (CRUD, per-user)
- `highlights.py` — atomic UPSERT via SQLite ON CONFLICT
- `bookmarks.py` — bookmark CRUD
- `reading_plans.py` — 101 built-in plan templates all startable, generic chapter scheduler, custom plans, today's readings, completion tracking, AI-generated plans
- `ai_reading_plans.py` — AI-generated personalized reading plans
- `word_study.py` — Greek/Hebrew per-verse word lookup
- `lexicon.py` — Strong's entries, occurrences
- `library.py` — book catalog + page fetch (prefers `library_pages`, falls back to pypdf)
- `dictionary.py` — dictionary lookup (table populated after re-ingest)
- `ai.py` — Claude streaming endpoints: study, explain, outline, cross-refs, word study, topic, sermon, discussion questions
- `ai_conversations.py` — persisted AI chat history per reference
- `book_intros.py` — AI-generated book introductions
- `cultural_notes.py` — AI-generated cultural context notes
- `factbook.py` — factbook (people, places, themes)
- `doctrine.py` — doctrine/systematic theology entries
- `lectionary.py` — Revised Common Lectionary readings by date with prev/next navigation
- `lectionary.py` — RCL entries with `prev_date`/`next_date` navigation + nearest-date fallback
- `gospel_harmony.py` — parallel Gospel passages
- `nt_ot.py` — NT quotations of OT passages
- `timeline_maps.py` — biblical timeline events + geographic places (Leaflet)
- `memorize.py` — memorization session tracking
- `prayer.py` — prayer journal entries
- `sermons.py` — AI sermon generation (audience-targeted)
- `sermon_series.py` — multi-sermon series management
- `study_projects.py` — study projects/outlines
- `groups.py` — groups CRUD, invitations, group notes, item sharing, activity feed (17 endpoints)
- `media.py` — file upload + serving (IDOR-protected)
- `annotations.py` — passage annotations
- `textual.py` / `textual_notes.py` — textual criticism notes
- `counseling.py` — pastoral counseling resources
- `dashboard.py` — aggregated dashboard data

Cross-cutting:
- `backend/auth.py` — JWT auth (`users` table) + optional shared-secret (`APP_PASSWORD`). `pwdlib[bcrypt]` for password hashing. Timing-safe `APP_PASSWORD` comparison. `JWT_SECRET_KEY` enforced ≥32 chars at startup.
- `backend/rate_limit.py` — **separate** per-IP token buckets for AI (15/min, 120/hr) and auth (5/min, 30/hr) endpoints. IP extracted from rightmost `X-Forwarded-For` hop (spoofing-resistant). JWT `/refresh` is also rate-limited.
- `backend/database.py` — async SQLite engine; `cache_size=256MB`, `mmap_size=512MB`, WAL mode, `busy_timeout=5000ms`
- `SecurityHeadersMiddleware` — CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS (production only via `DEPLOYMENT_ENV=production`)
- `GZipMiddleware` — compression for responses ≥ 500 bytes

### Frontend (pre-built in frontend/dist/)

#### Navigation & Layout
- **URL-canonical navigation** — `/{translation}/{book}/{chapter}/{verse?}` via React Router; refresh/share/back all work
- **Full-screen Bible Browser** at `/browse` — testament tabs (All/OT/NT), book groups, grid/list toggle, search filter, recently visited strip, chapter picker, jump-to-verse
- **Sidebar** — quick-action buttons; responsive: slide-in drawer overlay on mobile (`< md`), inline `w-56` column on desktop
- **TopBar** — user profile display, sign-out dropdown, pending group invitations badge, sync status indicator; all toggle buttons have `aria-pressed`
- **Right panel** — responsive: fixed bottom sheet (`h-[80vh]`) on mobile, inline `w-96` column on desktop

#### Right Panel — 5 Category Tabs, 25+ Panels (all code-split / lazy-loaded)

**Scripture category:**
- Commentary (15 sources, 539K entries)
- Insights (AI-generated passage insights)
- Passage Guide (unified commentary + word study + cross-refs in one view)
- Cross-Reference panel
- NT/OT connections panel
- Compare (side-by-side translation comparison with sync scroll + word diff)
- Cultural Context (AI-generated cultural notes)
- Gospel Harmony
- Doctrine panel

**Reference category:**
- Word Study (Greek/Hebrew interlinear words per verse, Strong's, morphology, gloss)
- Dictionary panel
- Factbook (people, places, themes)
- Library reader (book catalog, page reader, AI summarizer)
- Topical Search
- Lectionary (RCL readings by date, season/cycle badge, prev/next navigation)

**Visual category:**
- Timeline panel
- Maps panel (Leaflet)
- Dashboard (home/overview)

**Study category:**
- Notes (CRUD, inline media upload, markdown rendering, lightbox)
- Bookmarks (view + manage)
- Reading Plans (frontend panel — 101 built-in templates + custom + AI-generated + progress tracking)
- Memorize (memorization sessions)
- Prayer journal
- Study Builder (outlines, discussion questions generator)
- Counseling resources

**Ministry category:**
- AI Assistant (streaming, prompt caching, conversation history persisted per reference)
- Sermon Builder (audience-targeted AI sermon generation)
- Preaching Series (multi-sermon series management)
- Groups & Collaboration (group list, invites badge, group notes, item sharing, activity feed)
- Notifications settings

#### PWA & Offline
- Service worker registered at `/sw.js` (checks for updates on every page load)
- **Offline mutation queue** — `useOfflineSync` hook manages IndexedDB queue (`logos-offline-queue`), auto-flushes on reconnect; module-level `_flushing` guard prevents concurrent flush from multiple instances; React Query cache is invalidated after successful replay
- **SyncStatus** indicator in TopBar — shows online/offline/syncing/conflict state with pending-item badge
- Offline banner in app chrome with queue count and conflict notice

#### Other Frontend Features
- **Print / PDF export** — styled print window preserving verse text, highlights, and notes; `@media print` CSS hides UI chrome
- **Verse context menu** (right-click) — highlights, notes, bookmarks, share to group, print/PDF
- **DOMPurify** sanitizes all `dangerouslySetInnerHTML` sites (XSS protection)
- Full-text search modal (Cmd/Ctrl+K, lazy-loaded) with fuzzy Bible reference parsing + did-you-mean
- Lemma inline display — toggle, popup, per-verse lazy loading
- Dark mode with flash prevention; complete dark variants across all panels
- Translation selector (auto-loads from API)
- Auth gate (prompts for JWT login; stashes token in localStorage)
- Zustand persists UI preferences only (theme, font size, open panel)

### AI Assistant
- Streaming responses via `claude-sonnet-4-6`
- **Prompt caching** (`cache_control`) on system prompt + chapter-text block
- Auto-includes current chapter from React Query cache
- Per-IP rate limiting + JWT auth
- Modes: ask, explain, outline, cross-references, word study, topic study, sermon, discussion questions
- **Conversation history persisted** per reference (book/chapter) in `ai_conversations` table
- AI-generated reading plans, book introductions, cultural notes, passage insights

### Security (updated 2026-06-04)
- DOMPurify on all `dangerouslySetInnerHTML` (XSS)
- Auth + ownership checks on reading-plan completion and media file serving (IDOR)
- `JWT_SECRET_KEY` required at startup; enforced ≥ 32 chars
- SVG removed from media upload allowed types (stored XSS vector)
- Path traversal guard on media file serve (`.resolve()` + prefix assertion)
- JWT `/refresh` endpoint is rate-limited + rotates the refresh token on each use
- Separate rate-limit buckets for AI and auth endpoints (no cross-interference)
- `X-Forwarded-For` IP extraction uses rightmost (trusted proxy) hop — not spoofable
- Timing-safe `APP_PASSWORD` comparison
- SSE error messages sanitized (no raw `str(e)` leaks)
- `SecurityHeadersMiddleware` (CSP, X-Content-Type-Options, Referrer-Policy, HSTS in production)
- `GZipMiddleware` with 500-byte minimum
- `pwdlib[bcrypt]` for password hashing (actively maintained; works with bcrypt 4.x+)

### Migrations (alembic/)
| # | File | Contents |
|---|------|----------|
| 0001 | `initial_schema.py` | Core tables: verses, commentary, notes, highlights, bookmarks, reading plans, lexicon, library |
| 0002 | `user_accounts.py` | `users` table + JWT auth |
| 0003 | `ai_conversations.py` | Persisted AI chat history |
| 0004 | `media_files.py` | Image upload storage |
| 0005 | `library_pages_fts_and_fk_cascades.py` | FTS5 on `library_pages` |
| 0006 | `groups.py` | Groups, members, invites, group notes, shared items |
| 0007 | `doctrine_entries.py` | Doctrine/systematic theology table |
| 0008 | `reading_plan_type_goal.py` | Reading plan type + goal columns; index guard fixed |
| 0009 | `composite_indexes_and_fts_triggers.py` | Composite indexes on notes/highlights/plan_days + FTS5 sync triggers for library_pages |
| 0010 | `fk_cascade_ddl.py` | Batch-rebuilds 18 tables with correct `ON DELETE CASCADE` DDL |

### Tests, lint, startup
- `make test` — pytest (backend/tests); covers auth, Bible, notes, sermon, search, groups, highlights, media, users
- `make lint` — ruff
- `make frontend-lint` — ESLint flat config
- `make migrate` — alembic upgrade head
- `start.sh` — Python deps check, frontend build (skipped if up-to-date), port cleanup, uvicorn launch. `LD_LIBRARY_PATH` selects gcc-13+ lib (GLIBCXX ≥ 3.4.32 for Node.js 20)

## Known Gaps / Still Broken

| Feature | Status | Notes |
|---------|--------|-------|
| Lexicon full coverage | Reduced | 726 clean Dodson entries. Re-run `ingest/ingest_sword.py` with `StrongsGreek`/`StrongsHebrew` modules to restore full Strong's |
| Library PDF pages | Not extracted | Run `python -m ingest.extract_pdf_pages` to populate `library_pages`; FTS5 sync triggers are now in place (migration 0009) so newly ingested pages will be searchable |
| Audio player | UI exists | `AudioPlayer` component present; backend audio serving not confirmed |
| AI features | Need API key | All `/api/ai/*` endpoints require `ANTHROPIC_API_KEY` in Replit Secrets. Factbook/cultural notes/book intros/doctrine also AI-generated |
| Modal focus trapping | Partial | ARIA roles added; keyboard Tab does not yet cycle inside open modals (needs `focus-trap-react` or manual implementation) |

## Ingest Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `ingest/reingest_tsk.py` | Re-ingest TSK cross-references from SWORD ThML | After DB reset; downloads TSK.zip from CrossWire automatically |
| `ingest/reingest_dictionaries.py` | Re-ingest Easton/ISBE/Smith/Nave/Webster1828 from SWORD zLD | After DB reset; downloads all 5 modules from CrossWire automatically |
| `ingest/seed_factbook.py` | Pre-seed factbook from dictionary data | After reingest_dictionaries; run once |
| `ingest/ingest_sword.py` | Full SWORD ingest (Bibles, commentaries, lexicons) | Fresh install with SWORD zips in `library/sword/` |
| `ingest/ingest_stepbible.py` | Greek/Hebrew interlinear words | Fresh install with STEPBible TSV files |
