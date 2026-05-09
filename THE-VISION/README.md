# THE VISION — Bible Study App

This folder is the persistent knowledge base for this project. It carries context across sessions, Claude instances, and environment changes.

## What This Project Is

A full-stack Bible study application with:
- **React/Vite frontend** — reading, highlighting, notes, search
- **FastAPI backend** — serves Bible text, commentary, AI study assistance
- **2.24 GB SQLite database** (`data/bible.db`) — pre-ingested Bible text, commentaries, lexicon, library catalog

## Quick Links

| File | Purpose |
|------|---------|
| [CURRENT-STATE.md](./CURRENT-STATE.md) | What works now, what's broken, known gaps |
| [ROADMAP.md](./ROADMAP.md) | Planned features, priorities, backlog |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Replit setup, env vars, startup troubleshooting |
| [DATA.md](./DATA.md) | Database schema, what's loaded, what's missing |

## Stack

```
frontend/          React 18 + Vite + TailwindCSS + Zustand + React Query
backend/           FastAPI + SQLAlchemy (async) + SQLite + Anthropic SDK
data/bible.db      2.24 GB SQLite — Bible text, commentaries, lexicon, library
```

## How to Run

```bash
bash start.sh
```

The server starts at `http://0.0.0.0:8000` (Replit maps port 80 → 8000).

The frontend SPA is served as static files from `frontend/dist/` — rebuild it with:

```bash
cd frontend && npm run build
```
