# Environment & Setup

## Replit Configuration

| Setting | Value |
|---------|-------|
| Language | Python 3.11 (via Nix) |
| Node.js | 20 (via Nix) |
| Port | 8000 (external: 80) |
| Run command | `bash start.sh` |
| Deploy target | Cloud Run |

## Required Secrets (Replit → Tools → Secrets)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Powers all AI study features (Claude claude-sonnet-4-6) |

## Python Packages

Nix prevents system-wide pip installs. Packages are installed to:
```
.venv/lib/python3.11/site-packages/
```

`start.sh` sets `PYTHONPATH` to include this directory automatically.

To manually install a package:
```bash
pip3 install <package> --target .venv/lib/python3.11/site-packages/ --break-system-packages
```

## Database

- **Location**: `data/bible.db` (2.24 GB SQLite)
- **Source**: Google Drive folder `1B0g2n8cj0yXsqB2qHGgHhLZ6iPQalP84`
- **Download**: Handled by gdown (installed to `~/.local/bin/`)

If `bible.db` is missing (e.g., after Replit storage wipe), re-download:
```bash
PYTHONPATH=.venv/lib/python3.11/site-packages \
  python3 -m gdown --folder "1B0g2n8cj0yXsqB2qHGgHhLZ6iPQalP84" \
  --output data/ --no-cookies
```

## Frontend

Pre-built in `frontend/dist/`. Served as static files by FastAPI.

To rebuild after frontend source changes:
```bash
cd frontend
npm install
npm run build
```

## Starting the App

```bash
bash start.sh
```

This will:
1. Install Python deps into `.venv/`
2. Skip frontend build if `frontend/dist/` already exists
3. Start uvicorn on `0.0.0.0:${PORT:-8000}`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError` on startup | Run `pip3 install -r requirements.txt --target .venv/lib/python3.11/site-packages/ --break-system-packages` |
| AI returns 500 | Check `ANTHROPIC_API_KEY` is set in Replit Secrets |
| Bible text shows "Chapter not available" | Verify `data/bible.db` exists and is not 0 bytes |
| PDF reading returns 503 | Expected — PyMuPDF has Nix binary compat issue; see ROADMAP.md §4.1 |
| Frontend shows blank/errors | Rebuild: `cd frontend && npm run build` |
