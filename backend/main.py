"""FastAPI app entry point.

Lifespan:
  • runs `init_db()` to create user-mutable tables if they don't exist;
  • introspects DB readiness (verse count, FTS table presence) and stashes the
    FTS-availability flags on `search.set_fts_availability()` so the search
    router doesn't catch-all swallow query errors.

Routing order:
  • API routers first.
  • A SPA route serves `frontend/dist/index.html` for any non-API path.
  • The catch-all explicitly skips `api/*` so a misspelled route returns a
    proper 404 JSON instead of silently shipping HTML.
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).parent.parent / ".env")

from .auth import auth_is_enabled, require_app_password
from .database import db_status, init_db
from .routers import (
    ai,
    bible,
    bookmarks,
    commentary,
    dictionary,
    factbook,
    health,
    highlights,
    lexicon,
    library,
    notes,
    reading_plans,
    search,
    word_study,
)

logger = logging.getLogger("bible-study")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    status = await db_status()
    if not status["db_file_exists"]:
        logger.warning("Bible database file missing: %s", status["db_path"])
    elif not status["ok"]:
        logger.warning("Bible database present but empty: %s", status)
    else:
        logger.info("DB ready: %d verses, FTS bible=%s commentary=%s",
                    status["verses"], status["fts_bible"], status["fts_commentary"])

    search.set_fts_availability(
        bible=bool(status.get("fts_bible")),
        commentary=bool(status.get("fts_commentary")),
    )
    if auth_is_enabled():
        logger.info("App-level password authentication is enabled")
    yield


app = FastAPI(title="Bible Study App", version="1.0.0", lifespan=lifespan)


# CORS — driven from CORS_ORIGINS env (comma-separated). Default keeps the dev
# Vite origin working; empty string disables CORS (same-origin only).
_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-App-Password"],
    )


# Read-only routers — no auth required.
app.include_router(health.router)
app.include_router(bible.router)
app.include_router(commentary.router)
app.include_router(search.router)
app.include_router(word_study.router)
app.include_router(lexicon.router)
app.include_router(library.router)
app.include_router(dictionary.router)

# User-mutable routers — gated by APP_PASSWORD if it's set.
from fastapi import Depends  # noqa: E402  (kept here so the dep list is visible)
_protected = [Depends(require_app_password)]
app.include_router(notes.router, dependencies=_protected)
app.include_router(highlights.router, dependencies=_protected)
app.include_router(bookmarks.router, dependencies=_protected)
app.include_router(reading_plans.router, dependencies=_protected)

# AI router carries its own dependencies (auth + rate limit) at the router level.
app.include_router(ai.router)

# Factbook router carries its own dependencies (auth + rate limit).
app.include_router(factbook.router)


# SPA static files. Only mounted when the frontend has been built — keeps
# pytest happy when running from a checkout without `npm run build`.
FRONTEND_BUILD = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_BUILD.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_BUILD / "assets")),
        name="assets",
    )

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # An unknown API path must 404 as JSON — never silently serve index.html.
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        index = FRONTEND_BUILD / "index.html"
        return FileResponse(str(index))
