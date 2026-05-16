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
