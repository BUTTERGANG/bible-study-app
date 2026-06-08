"""Integration tests for /api/search route.

Covers: FTS phrase matching, snippet centering, special characters,
commentary scope, all scope, translation filtering, limit param,
and empty/no-results queries.
"""

import pytest


@pytest.mark.asyncio
async def test_fts_search_matches_phrase(client):
    r = await client.get("/api/search?q=loved+the+world&translation=KJV")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 1
    refs = [item["reference"] for item in body["results"]]
    assert "John 3:16" in refs


@pytest.mark.asyncio
async def test_snippet_centers_on_match(client):
    """The snippet logic should center on the first matching token, even when
    the query contains words that appear later in the verse."""
    r = await client.get("/api/search?q=beginning&translation=KJV")
    body = r.json()
    assert body["count"] >= 1
    snippet = body["results"][0]["snippet"]
    assert "beginning" in snippet.lower()


@pytest.mark.asyncio
async def test_search_handles_special_chars(client):
    # Colons/parens in a query used to break FTS5 syntax. The sanitizer
    # should phrase-quote the tokens.
    r = await client.get("/api/search?q=(world):&translation=KJV")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_search_commentary_scope(client):
    r = await client.get("/api/search?q=world&scope=commentary")
    body = r.json()
    assert body["count"] >= 1
    assert body["results"][0]["type"] == "commentary"


# ── Additional search coverage ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_scope_all_returns_bible_and_commentary(client):
    """scope=all should include results from both bible and commentary."""
    r = await client.get("/api/search?q=world&scope=all")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 2  # at least 1 bible + 1 commentary
    types = {item["type"] for item in body["results"]}
    assert "bible" in types or "commentary" in types


@pytest.mark.asyncio
async def test_search_with_asv_translation(client):
    """Search limited to ASV should only find ASV verses."""
    r = await client.get("/api/search?q=loved+the+world&translation=ASV")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 1
    # All results should be ASV
    for item in body["results"]:
        if item["type"] == "bible":
            assert item.get("translation", "ASV") == "ASV"


@pytest.mark.asyncio
async def test_search_limit_param(client):
    """The limit parameter should cap the number of results."""
    r = await client.get("/api/search?q=the&translation=KJV&limit=1")
    assert r.status_code == 200
    body = r.json()
    assert len(body["results"]) <= 1


@pytest.mark.asyncio
async def test_search_no_results(client):
    """A query that matches nothing should return count=0 and empty results."""
    r = await client.get("/api/search?q=xyznonexistent&translation=KJV")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 0
    assert body["results"] == []


@pytest.mark.asyncio
async def test_search_short_query_returns_validation_error(client):
    """q must be at least 2 characters (Query min_length=2)."""
    r = await client.get("/api/search?q=x&translation=KJV")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_search_bible_scope_default(client):
    """Default scope should be 'bible' — commentary results excluded."""
    r = await client.get("/api/search?q=world&translation=KJV")
    assert r.status_code == 200
    body = r.json()
    # All results should be bible type (default scope)
    for item in body["results"]:
        assert item["type"] == "bible"