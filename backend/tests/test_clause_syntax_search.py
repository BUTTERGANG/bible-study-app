"""Integration tests for fixture-backed clause syntax search."""

import pytest


@pytest.mark.asyncio
async def test_clause_syntax_search_by_mood(client):
    r = await client.post("/api/search/clause-syntax", json={"verb_mood": "imperative"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 1
    assert all(row["verb_mood"] == "imperative" for row in body["results"])


@pytest.mark.asyncio
async def test_clause_syntax_filters_by_role_and_highlight(client):
    r = await client.post("/api/search/clause-syntax", json={"role": "predicate", "book": "John"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 1
    row = body["results"][0]
    assert row["role"] == "predicate"
    assert row["book"] == "John"
    assert row["clause_text"]
    assert row["highlight"]["text"] == row["clause_text"]


@pytest.mark.asyncio
async def test_clause_syntax_filters_by_testament(client):
    r = await client.post("/api/search/clause-syntax", json={"scope": "ot"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 1
    assert all(row["book"] == "Genesis" for row in body["results"])


@pytest.mark.asyncio
async def test_clause_syntax_filters_by_pauline_scope(client):
    r = await client.post("/api/search/clause-syntax", json={"scope": "pauline", "verb_mood": "imperative"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 1
    assert {row["book"] for row in body["results"]}.issubset({"Romans", "Galatians"})


@pytest.mark.asyncio
async def test_clause_syntax_compound_lemma_query(client):
    r = await client.post("/api/search/clause-syntax", json={"scope": "pauline", "lemma": "περιπατέω", "role": "adjunct"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    row = body["results"][0]
    assert row["compound_match"] is True
    assert row["verb_lemma"] == "περιπατέω"
    assert row["role"] == "adjunct"


@pytest.mark.asyncio
async def test_clause_syntax_facets(client):
    r = await client.get("/api/search/clause-syntax/facets")
    assert r.status_code == 200
    body = r.json()
    assert "predicate" in body["roles"]
    assert "imperative" in body["moods"]
    assert "pauline" in body["scopes"]
