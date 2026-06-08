"""Integration tests for /api/textual (textual criticism variants)."""

import pytest


@pytest.mark.asyncio
async def test_list_variants_returns_seeded_data(client):
    r = await client.get("/api/textual")
    assert r.status_code == 200
    body = r.json()
    assert "variants" in body
    assert len(body["variants"]) >= 20  # we seed 20 curated variants
    v = body["variants"][0]
    assert "short_title" in v
    assert "significance" in v
    assert "explanation" in v
    assert "reference" in v


@pytest.mark.asyncio
async def test_filter_variants_by_book(client):
    r = await client.get("/api/textual?book=Mark")
    assert r.status_code == 200
    variants = r.json()["variants"]
    assert len(variants) >= 1
    for v in variants:
        assert v["book"] == "Mark"


@pytest.mark.asyncio
async def test_filter_variants_by_significance(client):
    r = await client.get("/api/textual?significance=critical")
    assert r.status_code == 200
    variants = r.json()["variants"]
    assert len(variants) >= 3  # at least Mark 16:9-20, Pericope Adulterae, Comma Johanneum
    for v in variants:
        assert v["significance"] == "critical"


@pytest.mark.asyncio
async def test_get_single_variant(client):
    r = await client.get("/api/textual")
    first_id = r.json()["variants"][0]["id"]

    r = await client.get(f"/api/textual/{first_id}")
    assert r.status_code == 200
    assert r.json()["id"] == first_id


@pytest.mark.asyncio
async def test_get_nonexistent_variant_returns_404(client):
    r = await client.get("/api/textual/999999")
    assert r.status_code == 404
