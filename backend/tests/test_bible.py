"""Integration tests for /api/bible routes.

Covers: health, book listing, translation listing, single-verse fetch,
chapter-level fetch, cross-translation compare, book-resolution aliases,
OT books, invalid inputs, and SPA-fallback 404 regression.
"""

import pytest


@pytest.mark.asyncio
async def test_health_reports_db(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["database"]["verses"] >= 4
    assert body["database"]["fts_bible"] is True


@pytest.mark.asyncio
async def test_get_books_returns_canonical_list(client):
    r = await client.get("/api/bible/books")
    assert r.status_code == 200
    books = r.json()
    names = [b["name"] for b in books]
    assert "Genesis" in names
    assert "Revelation" in names
    assert len(books) == 66


@pytest.mark.asyncio
async def test_get_translations_distinct(client):
    r = await client.get("/api/bible/translations")
    assert r.status_code == 200
    assert set(r.json()["translations"]) == {"ASV", "KJV"}


@pytest.mark.asyncio
async def test_get_verse(client):
    r = await client.get("/api/bible/KJV/John/3/16")
    assert r.status_code == 200
    assert "loved the world" in r.json()["text"]


@pytest.mark.asyncio
async def test_get_verse_404(client):
    r = await client.get("/api/bible/KJV/John/3/999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_book_resolution_handles_alias(client):
    # Lowercase + abbreviation should resolve.
    r = await client.get("/api/bible/KJV/john/3")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_compare_translations(client):
    r = await client.get("/api/bible/compare-translations/John/3/16?translations=KJV,ASV")
    assert r.status_code == 200
    body = r.json()
    assert "KJV" in body["translations"]
    assert "ASV" in body["translations"]


@pytest.mark.asyncio
async def test_unknown_api_route_returns_json_404(client):
    """Regression test for the SPA-swallows-API bug. A misspelled /api/* path
    must 404 as JSON, never silently fall through to index.html."""
    r = await client.get("/api/bible/this-is-not-a-route")
    assert r.status_code == 404
    # Body should be JSON, not HTML.
    assert r.headers["content-type"].startswith("application/json")


# ── Chapter-level fetch (GET /api/bible/{translation}/{book}/{chapter}) ─────


@pytest.mark.asyncio
async def test_get_chapter_returns_verses_list(client):
    """GET /api/bible/KJV/John/3 should return all verses in that chapter."""
    r = await client.get("/api/bible/KJV/John/3")
    assert r.status_code == 200
    body = r.json()
    assert body["translation"] == "KJV"
    assert body["book"] == "John"
    assert body["chapter"] == 3
    assert isinstance(body["verses"], list)
    assert len(body["verses"]) >= 2  # at least v16 and v17
    # Each verse dict must have 'verse' and 'text'
    for v in body["verses"]:
        assert "verse" in v
        assert "text" in v


@pytest.mark.asyncio
async def test_get_chapter_ot_book(client):
    """OT book fetch: Genesis 1 has at least verse 1."""
    r = await client.get("/api/bible/KJV/Genesis/1")
    assert r.status_code == 200
    body = r.json()
    assert body["book"] == "Genesis"
    assert any(v["verse"] == 1 for v in body["verses"])


@pytest.mark.asyncio
async def test_get_chapter_asv_translation(client):
    """ASV translation should work for chapter-level fetch."""
    r = await client.get("/api/bible/ASV/John/3")
    assert r.status_code == 200
    body = r.json()
    assert body["translation"] == "ASV"
    assert len(body["verses"]) >= 1  # at least v16


@pytest.mark.asyncio
async def test_get_chapter_404_for_nonexistent(client):
    """A chapter with no verses must return 404."""
    r = await client.get("/api/bible/KJV/John/999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_get_chapter_case_insensitive_translation(client):
    """Translation names should resolve case-insensitively."""
    r = await client.get("/api/bible/kjv/John/3")
    assert r.status_code == 200
    assert r.json()["translation"] == "KJV"


# ── Single verse fetch extras ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_verse_asv(client):
    """Fetch a verse in ASV translation."""
    r = await client.get("/api/bible/ASV/John/3/16")
    assert r.status_code == 200
    assert "loved the world" in r.json()["text"]


@pytest.mark.asyncio
async def test_get_verse_ot_book(client):
    """Fetch an OT verse (Genesis 1:1)."""
    r = await client.get("/api/bible/KJV/Genesis/1/1")
    assert r.status_code == 200
    assert "beginning" in r.json()["text"].lower()


@pytest.mark.asyncio
async def test_get_verse_includes_reference(client):
    """The verse response should include a reference string."""
    r = await client.get("/api/bible/KJV/John/3/16")
    assert r.status_code == 200
    body = r.json()
    assert body["reference"] == "John 3:16"


@pytest.mark.asyncio
async def test_get_verse_unknown_book_returns_404(client):
    """A made-up book name should 404, not 500."""
    r = await client.get("/api/bible/KJV/FakeBook/1/1")
    assert r.status_code == 404


# ── Translation-specific book listing ────────────────────────────────────


@pytest.mark.asyncio
async def test_translation_books_list(client):
    """GET /api/bible/translations/KJV/books should list books available in KJV."""
    r = await client.get("/api/bible/translations/KJV/books")
    assert r.status_code == 200
    body = r.json()
    assert body["translation"] == "KJV"
    book_names = [b["name"] for b in body["books"]]
    assert "John" in book_names
    assert "Genesis" in book_names


@pytest.mark.asyncio
async def test_translation_books_unknown_translation_404(client):
    """An unknown translation should 404."""
    r = await client.get("/api/bible/translations/FAKE/books")
    assert r.status_code == 404
