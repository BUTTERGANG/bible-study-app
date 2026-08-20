# Feature Gap Analysis vs. Logos Bible Software

**Date**: 2026-06-04 (session 3 update)
**Comparison target**: Logos Bible Software (logos.com) feature set
**Purpose**: Track which Logos features we have, which remain gaps

---

## Features We Now Have

| Logos Feature | Our Implementation | Status |
|---|---|---|
| Whole theological libraries searchable | 246 books + FTS5 on Bible, commentary, library_pages | ✅ Backend ready (pages need extraction) |
| Greek/Hebrew word studies | Full interlinear (137K Greek + 264K Hebrew) + Word Study panel + Lemma inline | ✅ Done |
| Better understanding at a glance | Commentary panel (15 sources, 539K entries) + Passage Guide unified view | ✅ Done |
| 24/7 Bible research assistant | AI Assistant (Claude, streaming, prompt caching, persisted history) | ✅ Done |
| Sermon preparation | Sermon Builder + Preaching Series (AI-generated, audience-targeted) | ✅ Done |
| Topical search | TopicalSearchPanel + AI topic study mode + Factbook | ✅ Done |
| Cross-references | CrossReferencePanel (OT/NT pill chips, verse peek, polished graph) + NT/OT panel + AI cross-references | ✅ Done |
| Notes & highlights | Full CRUD, inline media (image upload), dark mode, markdown rendering | ✅ Done |
| Reading plans | 101 built-in templates (all startable) + custom + AI-generated + frontend progress panel | ✅ Done |
| Timeline & maps | Timeline events + biblical places + Leaflet maps | ✅ Done |
| Passage Guide | Unified commentary + word study + cross-refs in one view | ✅ Done |
| Compare translations | Side-by-side with sync scroll + word diff | ✅ Done |
| Bookmarks panel | View + manage bookmarks | ✅ Done |
| Cultural context | AI-generated cultural notes panel | ✅ Done |
| Gospel harmony | Parallel Gospel passages panel | ✅ Done |
| Doctrine / Systematic theology | Doctrine panel + doctrine_entries table | ✅ Done |
| Lectionary | Revised Common Lectionary by date, season/cycle, prev/next nav | ✅ Done |
| Discussion questions | Generator in StudyBuilder | ✅ Done |
| Counseling resources | CounselingPanel | ✅ Done |
| User accounts | JWT auth, register/login, profile | ✅ Done |
| Collaborative study groups | Groups system: notes, sharing, invites, activity feed | ✅ Done |
| Offline / PWA | Service worker + IndexedDB mutation queue + sync status | ✅ Done |
| Print / PDF export | Styled print window from verse context menu | ✅ Done |
| Mobile-friendly | PWA installable, offline-capable; responsive layout (drawer + bottom sheet below 768px) | ✅ Done |
| AI conversation history | Persisted per reference (book/chapter) | ✅ Done |
| Bible browser | Full-screen book/chapter browser at `/browse` | ✅ Done |
| Verse sharing | URL-canonical references, shareable links | ✅ Done |
| Memorization | MemorizePanel with session tracking | ✅ Done |
| Prayer journal | PrayerPanel with journal entries | ✅ Done |

---

## Remaining Gaps

### Gap 1 — Data

#### 1A. Lexicon — Reduced Coverage
- **Logos equivalent**: Full Strong's Greek + Hebrew lexicon (10K+ entries)
- **Our state**: 726 clean Dodson entries; full Strong's needs re-ingest from `StrongsGreek`/`StrongsHebrew` SWORD modules
- **Fix**: Run `ingest/ingest_sword.py` targeting the Strongs lexicon modules
- **Effort**: Low

#### 1B. Library PDF Pages — Not Extracted
- **Logos equivalent**: 250,000+ searchable Christian books
- **Our state**: 246 books catalogued; `library_pages` FTS5 table is ready but empty; LibraryReader UI works
- **Fix**: Run `python -m ingest.extract_pdf_pages` on host with PDF files
- **Effort**: Medium (one-time extraction run, needs the PDFs)

#### 1C. AI Features Require API Key
- **Our state**: All `/api/ai/*` endpoints need `ANTHROPIC_API_KEY` in Replit Secrets
- **Affected**: AI assistant, explain/summarize/insights, cultural notes, book intros, doctrine, factbook generation, sermon builder, study builder, dashboard reflection, AI reading plans
- **Fix**: Add `ANTHROPIC_API_KEY` to Replit → Tools → Secrets
- **Effort**: Zero (key only)

---

### Gap 2 — Audio

#### 2A. Audio Playback
- **Logos equivalent**: Audio Bible playback
- **Our state**: `AudioPlayer` component exists in the frontend; no backend audio endpoint confirmed
- **Effort**: Medium (audio file source + serving endpoint)

---

### Gap 3 — Infrastructure

#### 3A. Automated Test Coverage
- **Our state**: pytest covers auth (JWT + rate limiting), Bible, notes (+ book validation), highlights, media, groups ACL, shares, streaks, tags, search, morph search, clause syntax, courses, sermons, and sermon series — 19 test files / 160 tests as of 2026-06-11. Still uncovered: AI conversations/conversation-mock paths, doctrine, lectionary, reading plans, lexicon, dashboard.
- **Effort**: Low-Medium (incremental)

#### 3B. Postgres for User Tables
- **Our state**: Everything in SQLite
- **Effort**: Medium-High; only needed at real multi-instance scale

---

## Priority-Ordered Remaining Backlog

| Priority | Item | Effort | Value |
|----------|------|--------|-------|
| P0 | Add ANTHROPIC_API_KEY to Replit Secrets | Zero | Critical — unlocks ~30% of features |
| P0 | Set JWT_SECRET_KEY (≥32 chars) for multi-user deployments | Zero | Required for user accounts |
| P1 | Re-ingest full Strong's lexicon | Low | High — unlocks dictionary deep-links |
| P1 | Extract library PDF pages | Medium | High — unlocks library reader + search |
| P2 | Audio backend for AudioPlayer | Medium | Medium |
| P2 | Modal focus trapping (keyboard accessibility) | Low | Medium — ARIA roles done; Tab cycling missing |
| P3 | Expand test coverage (AI conversations, doctrine, lectionary) | Medium | Medium |
| P4 | `python-jose` → `PyJWT` migration | Low | Low (patched to 3.5.0) |
| P4 | Postgres for user-mutable tables | Medium-High | Low (only at scale) |
