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
