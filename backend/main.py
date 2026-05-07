import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from database import init_db
from routers.bible import router as bible_router
from routers.commentary import router as commentary_router
from routers.notes import router as notes_router, highlights_router, bookmarks_router
from routers.search import router as search_router
from routers.ai import router as ai_router
from routers.word_study import router as word_study_router, lexicon_router
from routers.reading_plans import router as reading_plans_router
from routers.library import router as library_router, dictionary_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Bible Study App", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bible_router)
app.include_router(commentary_router)
app.include_router(notes_router)
app.include_router(highlights_router)
app.include_router(bookmarks_router)
app.include_router(search_router)
app.include_router(ai_router)
app.include_router(word_study_router)
app.include_router(lexicon_router)
app.include_router(reading_plans_router)
app.include_router(library_router)
app.include_router(dictionary_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# Serve React frontend in production
FRONTEND_BUILD = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_BUILD.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_BUILD / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index = FRONTEND_BUILD / "index.html"
        return FileResponse(str(index))
