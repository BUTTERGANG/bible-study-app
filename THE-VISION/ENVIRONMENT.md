# Environment & Setup

Last updated: 2026-05-16

## Replit Configuration

| Setting | Value |
|---------|-------|
| Language | Python 3.11 (via Nix) |
| Node.js | 20 (via Nix) |
| Port | 5000 (default; `PORT` env var overrides) |
| Run command | `bash start.sh` |
| Deploy target | Cloud Run |

## Required Secrets (Replit → Tools → Secrets)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Powers all AI study features (Claude `claude-sonnet-4-6`) |

## Optional Secrets

| Variable | Purpose |
|----------|---------|
| `APP_PASSWORD` | Shared-secret auth. When set, all write endpoints + AI require `Authorization: Bearer <pw>` or `X-App-Password` header. Frontend prompts once and stores in localStorage. Leave unset for open dev mode |
| `CORS_ORIGINS` | Comma-separated allowed CORS origins. Default: `http://localhost:5173,http://127.0.0.1:5173`. Set to empty string when frontend is same-origin |
| `AI_RATE_LIMIT_PER_MIN` | AI requests per IP per minute (default 15) |
| `AI_RATE_LIMIT_PER_HOUR` | AI requests per IP per hour (default 120) |
| `DATA_PATH` | Override database directory. Defaults to `./data` relative to the repo root |
| `LIBRARY_PATH` | Only needed by ingest scripts — points to the folder containing SWORD zips, PDFs, and STEPBible TSVs |
| `PORT` | Override the listen port (default 5000) |

## Python Packages

Nix prevents system-wide pip installs. Packages are installed to:
```
.venv/lib/python3.11/site-packages/
```

`start.sh` sets `PYTHONPATH` to include this directory automatically and
skips the install step when packages are already importable (fast cold
restart).

To manually install a package:
```bash
pip3 install <package> --target .venv/lib/python3.11/site-packages/ --break-system-packages
```

## Database

- **Location**: `data/bible.db` (2.24 GB SQLite)
- **Source**: Google Drive folder `1B0g2n8cj0yXsqB2qHGgHhLZ6iPQalP84`
- **Download**: Handled by gdown (installed to `~/.local/bin/`)
- **Migrations**: `make migrate` (alembic). Idempotent baseline migration covers all post-refactor schema changes — safe to run against any existing DB

If `bible.db` is missing (e.g., after Replit storage wipe), re-download:
```bash
PYTHONPATH=.venv/lib/python3.11/site-packages \
  python3 -m gdown --folder "1B0g2n8cj0yXsqB2qHGgHhLZ6iPQalP84" \
  --output data/ --no-cookies
```

`/api/health` reports DB readiness (file present, verse count, FTS table
availability). The startup banner logs the same info. If the DB is missing
or empty, the app still boots — only Bible/commentary/AI endpoints will 404
or return degraded results.

## Frontend

`frontend/dist/` is **gitignored** (removed from tracking on 2026-05-16). `start.sh` builds it automatically on cold start if the directory is missing. FastAPI serves the built output as static files in production.

To rebuild after frontend source changes:
```bash
make frontend-build
# or:
cd frontend && npm install && npm run build
```

## Starting the App

```bash
bash start.sh
# or:
make dev
```

This will:
1. Install Python deps into `.venv/` (skipped if already importable)
2. Build frontend via `npm run build` if `frontend/dist/` doesn't exist
3. Start uvicorn at `backend.main:app` on `0.0.0.0:${PORT:-5000}`

## Common Make Targets

```bash
make dev             # launch backend
make test            # pytest backend/tests
make lint            # ruff check backend/ ingest/
make lint-fix        # ruff --fix
make migrate         # alembic upgrade head
make frontend-build  # vite build
make frontend-lint   # eslint src
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError` on startup | Run `pip3 install -r requirements.txt --target .venv/lib/python3.11/site-packages/ --break-system-packages` |
| AI returns 503 with "ANTHROPIC_API_KEY is not set" | Set the secret in Replit Secrets |
| AI returns 429 | Per-IP rate limit. Raise via `AI_RATE_LIMIT_PER_MIN` / `AI_RATE_LIMIT_PER_HOUR`, or wait |
| Frontend shows "App password required" | `APP_PASSWORD` is set on the backend. Enter the same value in the prompt, or unset the env var for dev |
| `/api/health` reports `database.ok: false` | `data/bible.db` is missing or has zero verses. Re-download per the Database section above |
| Bible text shows "Chapter not available" | The translation doesn't cover that book. Try KJV/ASV/BSB for full coverage |
| PDF reading returns 503 | PyMuPDF unavailable and no pre-extracted pages. Run `python -m ingest.extract_pdf_pages` against an environment with the PDFs |
| Frontend shows blank/errors | Rebuild: `make frontend-build`. Check browser console for the underlying error |
| Search is slow | FTS indexes may be missing (`/api/health` shows `fts_bible: false`). They're built by `ingest_sword.py` |
| Lexicon returns nothing / Word Study empty | `lexicon_entries` has only 726 rows (corrupted data was purged 2026-05-16). Re-run `ingest/ingest_sword.py` against SWORD source data to restore coverage |
| Dictionary search returns no results | `dictionary_entries` is empty. The ingest routing bug is fixed — re-run `ingest/ingest_sword.py` to populate |
