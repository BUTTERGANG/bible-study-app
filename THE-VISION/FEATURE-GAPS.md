# Feature Gap Analysis vs. Logos Bible Software

**Date**: 2026-05-21  
**Comparison target**: Logos Bible Software (logos.com) feature set  
**Purpose**: Identify high-value features to add to the backlog

---

## Logos Features We Already Have

| Logos Feature | Our Implementation | Status |
|---|---|---|
| Whole theological libraries searchable | 246 books cataloged + FTS5 on Bible + commentary | ✅ Partial |
| Greek/Hebrew word studies | Full interlinear (137K Greek + 264K Hebrew) + Word Study panel | ✅ Done |
| Better understanding at a glance | Commentary panel (15 sources, 539K entries) | ✅ Done |
| 24/7 Bible research assistant | AI Assistant (Claude, streaming, prompt caching) | ✅ Done |
| Sermon preparation | Sermon Assistant (AI-generated, audience-targeted) | ✅ Done |
| Topical search | AI topic study mode + Factbook | ✅ Partial |
| Cross-references | NT-OT connections + AI cross-references | ✅ Partial |
| Notes & highlights | Full backend + frontend | ✅ Done |
| Reading plans | Backend complete (4 built-in + custom) | ⚠️ Backend only |
| Timeline & maps | Timeline events + biblical places + Leaflet maps | ✅ Done |

---

## Gap 1: Data Completeness (Blocks Other Features)

### 1A. Dictionary — Empty
- **Logos equivalent**: Full biblical dictionary (Easton, ISBE, Nave, Smith, Webster's 1828)
- **Our state**: `dictionary_entries` table is 0 rows
- **Fix**: Re-run `ingest/ingest_sword.py` (parser + routing bugs fixed 2026-05-16)
- **Effort**: Low (re-ingest script exists, just needs SWORD source data)
- **Value**: Unlocks dictionary panel UI (API + frontend hooks already exist)

### 1B. Lexicon — Reduced Coverage
- **Logos equivalent**: Full Strong's Greek + Hebrew lexicon (10K+ entries)
- **Our state**: 726 clean Dodson entries (down from 94K corrupted rows)
- **Fix**: Same re-ingest as 1A
- **Effort**: Low (same script run)
- **Value**: Restores full Strong's coverage for word study deep-links

### 1C. Library Content — Not Ingested
- **Logos equivalent**: 250,000+ Christian books & courses
- **Our state**: 246 books cataloged, 0 PDF pages extracted
- **Fix**: Run `ingest/extract_pdf_pages.py` against PDF library
- **Effort**: Medium (requires PDF files + one-time extraction run)
- **Value**: Unlocks in-app reader + library search

---

## Gap 2: Frontend UX (Backend Done, UI Missing)

### 2A. Reading Plan UI
- **Logos equivalent**: Reading plans with progress tracking
- **Our state**: Full backend (4 built-in plans, custom, today, complete, progress). No frontend panel.
- **Effort**: Medium (new RightPanel tab or top-level route)
- **Value**: High — daily engagement driver

### 2B. Compare Translations View
- **Logos equivalent**: Side-by-side translation comparison
- **Our state**: API endpoint `/api/bible/compare-translations/{book}/{chapter}/{verse}` works. No UI.
- **Effort**: Low-Medium (toggle in verse view or new RightPanel tab)
- **Value**: High — core study workflow

### 2C. Commentary Source Picker
- **Logos equivalent**: Filter commentary by source
- **Our state**: Backend accepts `?sources=` parameter. No UI control.
- **Effort**: Low (add checkbox list or multi-select in CommentaryPanel)
- **Value**: Medium — reduces noise for popular verses

### 2D. Bookmarks Panel
- **Logos equivalent**: Bookmark management
- **Our state**: Bookmark mutation works in verse context menu. No view/manage UI.
- **Effort**: Low (new RightPanel tab or dropdown)
- **Value**: Medium — user retention

### 2E. Verse Sharing / Export
- **Logos equivalent**: Share passages, export formatted text
- **Our state**: URL routing makes references shareable. No "Copy link" action. No export.
- **Effort**: Low (add to VerseContextMenu + export formatter)
- **Value**: Medium — social sharing + portability

---

## Gap 3: AI Enhancement

### 3A. Study Outlines → Notes
- **Logos equivalent**: Save study outlines
- **Our state**: `/api/ai/outline` returns structured outlines. Not connected to notes API.
- **Effort**: Low (wire outline → notes save button)
- **Value**: Medium — workflow completion

### 3B. Cross-Reference Map Visualization
- **Logos equivalent**: Visual cross-reference graph
- **Our state**: `/api/ai/cross-references` returns text. No visualization.
- **Effort**: Medium-High (graph viz library + layout)
- **Value**: High — unique visual differentiator

### 3C. Conversation History Persistence
- **Logos equivalent**: Study history
- **Our state**: AI chat resets on chapter change (in-memory only)
- **Effort**: Medium (persist snapshots tied to reference)
- **Value**: Medium — continuity of study

---

## Gap 4: Library & Content

### 4A. In-App Library Reader
- **Logos equivalent**: Full library reader with pagination
- **Our state**: Pages can be pre-extracted. No reader component.
- **Effort**: Medium (paginated reader + navigation)
- **Value**: High — unlocks 246 cataloged books

### 4B. Library Content Search
- **Logos equivalent**: Search across entire library
- **Our state**: No FTS5 on `library_pages.text`
- **Effort**: Low (add FTS5 index + search endpoint)
- **Value**: High — makes library actually usable

---

## Gap 5: Infrastructure

### 5A. Real Multi-User Auth
- **Logos equivalent**: User accounts with sync
- **Our state**: Shared-secret `APP_PASSWORD` only
- **Effort**: High (user IDs on all mutable tables, migration, session management)
- **Value**: Medium — needed for multi-user households

### 5B. Offline / PWA
- **Logos equivalent**: Mobile apps with offline access
- **Our state**: No service worker, no offline cache
- **Effort**: Medium (service worker + cache strategy)
- **Value**: High — mobile/offline use cases

### 5C. Postgres for User Tables
- **Logos equivalent**: Cloud sync
- **Our state**: Everything in SQLite
- **Effort**: Medium-High (split DB, migration)
- **Value**: Low-Medium — only needed at scale

---

## Gap 6: Logos Features We Don't Have At All

### 6A. Advanced Topical Search
- **Logos**: "See what the Bible says about anything" — AI-powered topical index
- **Ours**: AI topic study mode exists but no dedicated topical index UI
- **Effort**: Medium (build topical index browser + AI enhancement)
- **Value**: High — Logos' marquee feature

### 6B. Counseling Resources
- **Logos**: Counseling resource guides
- **Ours**: None
- **Effort**: Medium-High (content curation + UI)
- **Value**: Medium — niche but high-impact use case

### 6C. Passage Guide / Exegesis Workflow
- **Logos**: Automated passage guide (commentary + word study + cross-refs in one view)
- **Ours**: All pieces exist but are in separate tabs
- **Effort**: Medium (unified passage guide view)
- **Value**: High — streamlined study workflow

### 6D. Visual Bible Summaries
- **Logos**: "At a glance" book/chapter summaries
- **Ours**: AI can generate these but no dedicated UI
- **Effort**: Low-Medium (AI-generated summary card on chapter load)
- **Value**: Medium — quick orientation

---

## Priority-Ordered Backlog

### P0 — Unlock Existing Backend (Do First)
1. **Re-ingest lexicon & dictionary** — Unlocks dictionary panel + full Strong's
2. **Extract PDF pages** — Unlocks library reader + search

### P1 — High-Value Frontend (Next Sprint)
3. **Reading Plan UI** — Backend done, just needs frontend
4. **Compare Translations View** — API done, needs UI toggle
5. **Commentary Source Picker** — One parameter, no UI
6. **Verse Sharing / Export** — Copy link + export

### P2 — AI Enhancement
7. **Study Outlines → Notes** — Wire existing endpoints together
8. **Passage Guide** — Unified view of commentary + word study + cross-refs
9. **Conversation History** — Persist AI chat per reference

### P3 — Library & Content
10. **In-App Library Reader** — Paginated reader component
11. **Library Content Search** — FTS5 on library_pages
12. **Advanced Topical Search** — Dedicated topical index UI

### P4 — Infrastructure
13. **Offline / PWA** — Service worker + cache
14. **Real Multi-User Auth** — User accounts
15. **Postgres for User Tables** — Scale readiness

### P5 — Nice to Have
16. **Cross-Reference Map Visualization** — Graph viz
17. **Visual Bible Summaries** — AI summary cards
18. **Counseling Resources** — Content + UI
