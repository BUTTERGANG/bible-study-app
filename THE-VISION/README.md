# THE VISION — Bible Study App

This folder is the persistent knowledge base for this project. It carries context across sessions, Claude instances, and environment changes.

## What This Project Is

A full-stack Bible study application with:
- **React/Vite frontend** — reading, highlighting, notes, AI study, search
- **FastAPI backend** — serves Bible text, commentary, AI study assistance
- **2.24 GB SQLite database** (`data/bible.db`) — pre-ingested Bible text, commentaries, lexicon, library catalog

## Quick Links

| File | Purpose |
|------|---------|
| [CURRENT-STATE.md](./CURRENT-STATE.md) | What works now, what's broken, known gaps |
| [ROADMAP.md](./ROADMAP.md) | Recently shipped + planned features, priorities, backlog |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Replit setup, env vars, startup troubleshooting |
| [DATA.md](./DATA.md) | Database schema, what's loaded, migrations |

## Stack

```
frontend/          React 18 + Vite + TailwindCSS + Zustand + React Query
backend/           Python package — FastAPI + SQLAlchemy (async) + SQLite + Anthropic SDK
data/bible.db      2.24 GB SQLite — Bible text, commentaries, lexicon, library
alembic/           Schema migrations
ingest/            Bulk-loader scripts (SWORD, STEPBible, PDFs, page extraction)
```

> **Note on `frontend/dist/`** — the build output is gitignored and not committed. `start.sh` builds it automatically on cold start (`npm run build`) if it doesn't exist.

## How to Run

```bash
bash start.sh
# or:
make dev
```

The server starts at `http://0.0.0.0:5000` (Replit maps port 5000 externally;
port 8000 is mapped to 80 if you run it there explicitly).

The frontend SPA is served as static files from `frontend/dist/` — rebuild
it with:

```bash
make frontend-build
```

## Common Commands

```bash
make test            # pytest (backend/tests, 26 tests)
make lint            # ruff check backend/ ingest/
make migrate         # alembic upgrade head
make frontend-build  # vite build
make frontend-lint   # eslint src
```

## Architecture Notes

- **Backend is a Python package** (`backend/`). Launch with `python -m uvicorn backend.main:app` — no `sys.path` hacks anywhere. One resource per router file.
- **URL is the canonical navigation state.** `useUrlSync` keeps `/{translation}/{book}/{chapter}/{verse?}` in sync with Zustand. Zustand persists only UI preferences (theme, font size, open panel).
- **Auth.** When `APP_PASSWORD` is set, write endpoints + AI endpoints require a Bearer token. The frontend's `AuthGate` prompts once and stashes the value in localStorage.
- **AI rate limit.** Per-IP token-bucket gates `/api/ai/*` (defaults: 15/min, 120/hr). Tune via `AI_RATE_LIMIT_PER_MIN` / `AI_RATE_LIMIT_PER_HOUR`.
- **Prompt caching.** AI requests use `cache_control` on the system prompt and (when present) the chapter-text block — multi-turn conversations don't re-bill the same tokens.
- **Chapter-aware AI.** The assistant auto-pulls the current chapter from the React Query cache and ships it as context with each question.
- **Search.** FTS5 over `bible_verses` and `commentary_entries`. Availability is detected at startup (no try/except fallback). Snippet generation centers on the earliest matching token.
- **Highlights.** Atomic UPSERT via SQLite ON CONFLICT against a `UNIQUE(translation, book, chapter, verse)` index — no read-then-write race.
- **Reading plans.** Schedule is normalized into `reading_plan_days` — `/today` is a single-query lookup, no N+1.
- **Library / PDF.** Production should pre-extract pages via `python -m ingest.extract_pdf_pages`. The library endpoints then serve from the `library_pages` table without needing PyMuPDF at runtime.
- **SPA fallback explicitly skips `/api/*`** — a misspelled API path 404s as JSON, never silently serves `index.html`.
- **Ingest scripts** in `ingest/` are run offline (need source data). As of 2026-05-16, `ingest_sword.py` has a corrected zLD parser and proper `lexicon_entries` vs `dictionary_entries` routing — re-ingest required to restore full lexicon/dictionary coverage.

## Tests

`make test` runs pytest against an isolated, seeded test DB (the 2.24 GB
content DB is never touched). Coverage includes:
- Bible read paths + book-name alias resolution
- Search FTS + snippet centering + special-char sanitation
- Notes CRUD + Highlight UPSERT atomicity
- Auth gate (bearer + header forms, missing/wrong password)
- Regression: unknown `/api/*` path returns JSON 404, not HTML
