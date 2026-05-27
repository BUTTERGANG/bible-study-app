"""Media upload and serving endpoints.

Stores uploaded files on disk under DATA_PATH/media/ and tracks metadata in the
media_files table. Files are served via a static mount for fast access.

Storage layout:
  data/media/{user_id}/{YYYYMMDD}_{uuid}.{ext}
"""

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import DATA_PATH, get_db
from ..models import MediaFile, Note

router = APIRouter(prefix="/api/media", tags=["media"])

MEDIA_ROOT = DATA_PATH / "media"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}


def _user_dir(user_id: int) -> Path:
    d = MEDIA_ROOT / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    note_id: int = Form(default=0),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    # --- validate content type ---
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {content_type}. Allowed: {', '.join(sorted(ALLOWED_TYPES))}",
        )

    # --- validate extension ---
    original = file.filename or "upload"
    ext = Path(original).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported extension: {ext}. Allowed: {', '.join(sorted(ALLOWED_EXT))}",
        )

    # --- read & size-check ---
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data)} bytes). Max: {MAX_FILE_SIZE} bytes (5 MB).",
        )

    # --- verify it's really an image (magic bytes, imghdr removed in Python 3.13+) ---
    if content_type != "image/svg+xml":
        _MAGIC = {
            b'\xff\xd8\xff': 'jpeg',
            b'\x89PNG': 'png',
            b'GIF87a': 'gif',
            b'GIF89a': 'gif',
            b'RIFF': 'webp',  # webp starts with RIFF....WEBP
        }
        is_image = any(data.startswith(m) for m in _MAGIC)
        # Extra check for webp: bytes 8-12 should be b'WEBP'
        if not is_image and data[:4] == b'RIFF' and data[8:12] == b'WEBP':
            is_image = True
        # SVG check: look for <svg in first 1024 bytes
        if not is_image and content_type == "image/svg+xml":
            is_image = b'<svg' in data[:1024].lower()
        if not is_image:
            raise HTTPException(status_code=400, detail="File is not a valid image.")

    # --- if note_id given, verify ownership ---
    if note_id:
        note_row = await db.execute(
            select(Note).where(Note.id == note_id, Note.user_id == user.id)
        )
        if not note_row.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Note not found")

    # --- write to disk ---
    today = datetime.utcnow().strftime("%Y%m%d")
    safe_name = f"{today}_{uuid.uuid4().hex}{ext}"
    udir = _user_dir(user.id)
    fpath = udir / safe_name
    with open(fpath, "wb") as fh:
        fh.write(data)

    # --- extract image dimensions (best-effort, skip for svg) ---
    width = height = None
    if content_type in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        try:
            from PIL import Image as PILImage
            import io
            img = PILImage.open(io.BytesIO(data))
            width, height = img.size
        except Exception:
            pass  # PIL may not be installed; skip dimensions

    # --- record in DB ---
    media = MediaFile(
        user_id=user.id,
        note_id=note_id or None,
        filename=safe_name,
        original_filename=original,
        mime_type=content_type,
        file_size=len(data),
        storage_path=f"{user.id}/{safe_name}",
        caption=caption or None,
        width=width,
        height=height,
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)

    return {
        "id": media.id,
        "filename": media.filename,
        "original_filename": media.original_filename,
        "mime_type": media.mime_type,
        "file_size": media.file_size,
        "caption": media.caption,
        "width": media.width,
        "height": media.height,
        "url": f"/api/media/file/{user.id}/{safe_name}",
        "created_at": media.created_at.isoformat(),
    }


@router.get("/file/{user_id}/{filename}")
async def serve_media(
    user_id: int,
    filename: str,
    db: AsyncSession = Depends(get_db),
):
    """Serve a media file. Public read — auth is enforced at upload time only.
    The filename is the safe UUID-based name, not the original upload name."""
    fpath = MEDIA_ROOT / str(user_id) / filename
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Look up mime type from DB
    storage_path = f"{user_id}/{filename}"
    result = await db.execute(
        select(MediaFile).where(MediaFile.storage_path == storage_path)
    )
    media = result.scalar_one_or_none()
    mime = media.mime_type if media else "application/octet-stream"

    from fastapi.responses import FileResponse
    return FileResponse(str(fpath), media_type=mime)


@router.get("")
async def list_media(
    note_id: int = 0,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    query = select(MediaFile).where(MediaFile.user_id == user.id)
    if note_id:
        query = query.where(MediaFile.note_id == note_id)
    query = query.order_by(MediaFile.created_at.desc())
    result = await db.execute(query)
    items = []
    for m in result.scalars().all():
        items.append({
            "id": m.id,
            "filename": m.filename,
            "original_filename": m.original_filename,
            "mime_type": m.mime_type,
            "file_size": m.file_size,
            "caption": m.caption,
            "width": m.width,
            "height": m.height,
            "url": f"/api/media/file/{m.user_id}/{m.filename}",
            "note_id": m.note_id,
            "created_at": m.created_at.isoformat(),
        })
    return {"media": items}


@router.delete("/{media_id}")
async def delete_media(
    media_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(MediaFile).where(MediaFile.id == media_id, MediaFile.user_id == user.id)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    # Remove from disk
    fpath = MEDIA_ROOT / media.storage_path
    if fpath.exists():
        fpath.unlink()

    await db.delete(media)
    await db.commit()
    return {"ok": True}
