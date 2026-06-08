"""FastAPI app entry point.

Lifespan:
  - runs init_db() to create user-mutable tables if they don't exist;
  - introspects DB readiness and sets FTS availability flags.

Routing order:
  - API routers first.
  - SPA route serves frontend/dist/index.html for any non-API path.
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).parent.parent / ".env")

from .auth import auth_is_enabled, get_current_user, require_app_password
from .database import db_status, init_db
from .routers import (
    ai, ai_conversations, ai_reading_plans, annotations, bible, book_intros,
    bookmarks, commentary, counseling, cultural_notes, dashboard, dictionary,
    doctrine, factbook, gospel_harmony, groups, health, highlights, lectionary,
    lexicon, library, media, memorize, notes, nt_ot, prayer, reading_plans,
    search, sermon_series, sermons, shares, streaks, study_projects, tags,
    textual, textual_notes, timeline_maps, users, word_study,
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
        logger.info("DB ready: %d verses, FTS bible=%s commentary=%s", status["verses"], status["fts_bible"], status["fts_commentary"])
    search.set_fts_availability(bible=bool(status.get("fts_bible")), commentary=bool(status.get("fts_commentary")))
    from .database import SessionLocal
    async with SessionLocal() as _db:
        seeded = await nt_ot.seed_nt_ot_connections(_db)
        if seeded: logger.info("NT-OT: inserted %d seed connections", seeded)
    async with SessionLocal() as _db:
        tl_seeded = await timeline_maps.seed_timeline_data(_db)
        if tl_seeded: logger.info("Timeline/Maps: inserted %d events + places + routes", tl_seeded)
    if auth_is_enabled(): logger.info("App-level password authentication is enabled")
    yield

app = FastAPI(title="Bible Study App", version="1.0.0", lifespan=lifespan)

_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=_cors_origins, allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-App-Password"])

from starlette.middleware.base import BaseHTTPMiddleware
_IS_PRODUCTION = os.getenv("DEPLOYMENT_ENV", "").lower() == "production"

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'sha256-vs2txtwuispTYLIGP6uPwYQp8oTLajEAvuLw2P8b4HY='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self'"
        if _IS_PRODUCTION: response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=500)

app.include_router(health.router)
app.include_router(bible.router)
app.include_router(book_intros.router)
app.include_router(commentary.router)
app.include_router(search.router)
app.include_router(word_study.router)
app.include_router(lexicon.router)
app.include_router(library.router)
app.include_router(dictionary.router)
app.include_router(cultural_notes.router)
app.include_router(gospel_harmony.router)
app.include_router(lectionary.router)

from fastapi import Depends
_protected = [Depends(get_current_user)]
app.include_router(notes.router, dependencies=_protected)
app.include_router(highlights.router, dependencies=_protected)
app.include_router(bookmarks.router, dependencies=_protected)
app.include_router(reading_plans.router, dependencies=_protected)
app.include_router(users.router)
app.include_router(ai.router)
app.include_router(ai_conversations.router)
app.include_router(ai_reading_plans.router)
app.include_router(sermons.router)
app.include_router(sermon_series.router)
app.include_router(memorize.router)
app.include_router(prayer.router)
app.include_router(study_projects.router)
app.include_router(dashboard.router)
app.include_router(groups.router, dependencies=_protected)
app.include_router(shares.router)
app.include_router(streaks.router, dependencies=_protected)
app.include_router(tags.router, dependencies=_protected)
app.include_router(factbook.router)
app.include_router(doctrine.router)
app.include_router(counseling.router)
app.include_router(nt_ot.router)
app.include_router(textual.router)
app.include_router(textual_notes.router)
app.include_router(timeline_maps.router)
app.include_router(annotations.router, dependencies=_protected)
app.include_router(media.router)

FRONTEND_BUILD = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_BUILD.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_BUILD / "assets")), name="assets")
    _icons_dir = FRONTEND_BUILD / "icons"
    if _icons_dir.exists(): app.mount("/icons", StaticFiles(directory=str(_icons_dir)), name="icons")
    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"): raise HTTPException(status_code=404, detail="Not found")
        candidate = FRONTEND_BUILD / full_path
        if "." in Path(full_path).name:
            if candidate.exists(): return FileResponse(str(candidate))
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(str(FRONTEND_BUILD / "index.html"), headers={"Cache-Control": "no-store"})
