"""Integration tests for the /api/media/upload endpoint.

Covers:
  - Valid JPEG upload → 200 with metadata
  - SVG upload → 415 (SVG was removed from ALLOWED_TYPES)
  - File exceeding 5 MB → 413

The media router is included in main.py without the global _protected list,
but every handler still calls `Depends(get_current_user)` inline. With
APP_PASSWORD="" the app is in open mode so unauthenticated requests resolve
to CurrentUser(id=0, is_legacy=True) — no Authorization header needed.

A minimal valid JPEG is constructed from raw magic bytes; no Pillow is needed
on the test side.  The server's PIL-based dimension extraction is best-effort
and wrapped in a try/except, so absence of Pillow on the test runner is fine.
"""

import io

import pytest


# ── Helpers ───────────────────────────────────────────────────────────────


def _make_jpeg(size_bytes: int = 512) -> bytes:
    """Return a byte string that starts with JPEG magic bytes (0xFF 0xD8 0xFF).

    The remaining bytes are zeroed padding.  The server checks only magic bytes
    and the content-type header; a real decoder is never invoked.
    """
    header = b"\xff\xd8\xff\xe0"  # SOI + APP0 marker
    return header + b"\x00" * max(0, size_bytes - len(header))


def _make_png() -> bytes:
    """Minimal PNG magic bytes."""
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


# ── Upload valid JPEG ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_valid_jpeg_returns_200_with_metadata(client):
    jpeg_data = _make_jpeg(1024)

    r = await client.post(
        "/api/media/upload",
        files={"file": ("photo.jpg", io.BytesIO(jpeg_data), "image/jpeg")},
        data={"caption": "Test image"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "id" in body
    assert body["mime_type"] == "image/jpeg"
    assert body["original_filename"] == "photo.jpg"
    assert body["file_size"] == len(jpeg_data)
    assert body["caption"] == "Test image"
    assert body["url"].startswith("/api/media/file/")


@pytest.mark.asyncio
async def test_upload_valid_png_returns_200(client):
    png_data = _make_png()

    r = await client.post(
        "/api/media/upload",
        files={"file": ("image.png", io.BytesIO(png_data), "image/png")},
    )
    assert r.status_code == 200
    assert r.json()["mime_type"] == "image/png"


# ── SVG rejection (415) ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_svg_returns_415(client):
    """SVG is not in ALLOWED_TYPES — must be rejected with 415."""
    svg_data = b"<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>"

    r = await client.post(
        "/api/media/upload",
        files={"file": ("icon.svg", io.BytesIO(svg_data), "image/svg+xml")},
    )
    assert r.status_code == 415


@pytest.mark.asyncio
async def test_upload_svg_with_text_xml_content_type_returns_415(client):
    """SVG disguised as text/xml should also be rejected."""
    svg_data = b"<svg xmlns='http://www.w3.org/2000/svg'></svg>"

    r = await client.post(
        "/api/media/upload",
        files={"file": ("image.svg", io.BytesIO(svg_data), "text/xml")},
    )
    assert r.status_code == 415


@pytest.mark.asyncio
async def test_upload_pdf_returns_415(client):
    """PDF is not in ALLOWED_TYPES either."""
    pdf_data = b"%PDF-1.4 fake pdf content"

    r = await client.post(
        "/api/media/upload",
        files={"file": ("doc.pdf", io.BytesIO(pdf_data), "application/pdf")},
    )
    assert r.status_code == 415


# ── File too large (413) ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_file_over_5mb_returns_413(client):
    """Files larger than 5 MB (5 * 1024 * 1024 bytes) must be rejected with 413."""
    over_limit = 5 * 1024 * 1024 + 1  # one byte over the 5 MB cap
    large_jpeg = _make_jpeg(over_limit)

    r = await client.post(
        "/api/media/upload",
        files={"file": ("big.jpg", io.BytesIO(large_jpeg), "image/jpeg")},
    )
    assert r.status_code == 413


@pytest.mark.asyncio
async def test_upload_file_exactly_at_5mb_limit_is_accepted(client):
    """A file that is exactly 5 MB should pass the size check."""
    exactly_5mb = _make_jpeg(5 * 1024 * 1024)

    r = await client.post(
        "/api/media/upload",
        files={"file": ("exact.jpg", io.BytesIO(exactly_5mb), "image/jpeg")},
    )
    assert r.status_code == 200


# ── Extension mismatch (415) ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_jpeg_with_wrong_extension_returns_415(client):
    """Valid JPEG content-type but disallowed extension (.bmp) must be 415."""
    jpeg_data = _make_jpeg(512)

    r = await client.post(
        "/api/media/upload",
        files={"file": ("photo.bmp", io.BytesIO(jpeg_data), "image/jpeg")},
    )
    assert r.status_code == 415
