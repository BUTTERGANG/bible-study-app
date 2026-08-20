# Bible Study App

Bible study application — scripture study tools, reading plans, and community features.

A full-stack Bible study platform with deep original-language study tools, an
AI study assistant, collaborative groups, and offline-first PWA support.

- **Frontend**: React 18 + Vite + TailwindCSS + Zustand + React Query
- **Backend**: FastAPI + SQLAlchemy (async) + SQLite + Anthropic SDK
- **Database**: `data/bible.db` — a 2.24 GB pre-ingested SQLite DB
- **Migrations**: Alembic (single linear chain, head `0022`)
- **Ingest**: offline bulk-loader scripts (SWORD, STEPBible, PDFs)

> The full content database is 2.24 GB and distributed separately (see
> `THE-VISION/DATA.md`). It is not committed to git.

---

## Quick Start

```bash
bash start.sh          # check deps, build frontend if needed, launch uvicorn
# or
make dev
```

The server starts at `http://0.0.0.0:5000`. The SPA is served from
`frontend/dist/` (built automatically by `start.sh`).

## Common Commands

| Command | Purpose |
|---------|---------|
| `make test` | Run pytest (backend/tests, **160 tests**) |
| `make lint` | ruff check on `backend/` + `ingest/` |
| `make migrate` | alembic upgrade head |
| `make frontend-build` | vite build |
| `make frontend-lint` | eslint src (0 warnings enforced) |

## Features

- **Bible reading** — 394K+ verses across 13 translations, side-by-side
  compare with word diff, print/PDF export
- **Original-language study** — full NT Greek (137K words) + OT Hebrew
  (264K words) interlinear, inline lemma display, Strong's lexicon
- **Reference tools** — 539K commentary entries from 15 sources, 85K+
  dictionary entries, cross-references, NT/OT connections, lectionary,
  gospel harmony, factbook, library reader
- **AI assistant** — Claude streaming with prompt caching and persisted
  per-reference conversation history; AI reading plans, book intros,
  cultural notes, passage insights, sermons and preaching series,
  counseling resources, courses and clause-syntax search
- **Study tools** — notes, highlights, bookmarks, reading plans,
  memorization, prayer journal, study builder, doctrine
- **Collaboration** — groups, invitations, group notes, item sharing,
  activity feed, shareable study-session links, reading streaks & badges,
  community tags
- **Offline PWA** — service worker, offline mutation queue with sync status

## Testing & Lint

```bash
make test            # pytest, isolated seeded test DB — 160 passed
make lint            # ruff — clean
make frontend-build  # vite build — clean
make frontend-lint   # eslint --max-warnings 0 — clean
```

## Docs & Project Vision

See `THE-VISION/` for the persistent knowledge base (current state, roadmap,
data model, environment) and `SCRUM/` for sprint tracking.

## Resources

| Router dir | Count |
|------------|-------|
| `backend/routers/` | 43 routers |
| `backend/tests/` | 19 test files |
| `alembic/versions/` | 22 migrations (head `0022`) |
