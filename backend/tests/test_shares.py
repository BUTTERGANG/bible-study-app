"""Integration tests for /api/shares (shareable study session links)."""

import pytest

import backend.rate_limit as _rl


def _clear_buckets():
    _rl._auth_buckets.clear()


async def _register(client, email: str) -> str:
    _clear_buckets()
    r = await client.post("/api/users/register", json={"email": email, "password": "testpass1"})
    assert r.status_code == 201
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_share_returns_token_and_url(client):
    token = await _register(client, "shares_create@example.com")

    r = await client.post("/api/shares", json={
        "book": "John", "chapter": 3, "translation": "KJV"
    }, headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert "share_token" in body
    assert body["url"].startswith("/share/")
    assert "expires_at" in body
    assert len(body["share_token"]) == 36  # UUID


@pytest.mark.asyncio
async def test_resolve_share_returns_passage(client):
    token = await _register(client, "shares_resolve@example.com")

    r = await client.post("/api/shares", json={
        "book": "John", "chapter": 3, "translation": "KJV"
    }, headers=_auth(token))
    share_token = r.json()["share_token"]

    # Resolve the share (public — no auth needed)
    r = await client.get(f"/api/shares/{share_token}")
    assert r.status_code == 200
    body = r.json()
    assert body["book"] == "John"
    assert body["chapter"] == 3
    assert body["translation"] == "KJV"
    assert isinstance(body["passage"], list)
    assert len(body["passage"]) >= 1
    # View count increments
    assert body["view_count"] >= 1


@pytest.mark.asyncio
async def test_resolve_nonexistent_token_returns_404(client):
    r = await client.get("/api/shares/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_share_with_notes(client):
    token = await _register(client, "shares_notes@example.com")
    headers = _auth(token)

    note_r = await client.post("/api/notes", json={
        "book": "John", "chapter": 3, "verse": 16, "content": "Shareable note"
    }, headers=headers)
    note_id = note_r.json()["id"]

    r = await client.post("/api/shares", json={
        "book": "John", "chapter": 3, "note_ids": [note_id], "translation": "KJV"
    }, headers=headers)
    assert r.status_code == 200
    share_token = r.json()["share_token"]

    r = await client.get(f"/api/shares/{share_token}")
    assert r.status_code == 200
    notes = r.json()["notes"]
    assert any(n["id"] == note_id for n in notes)


@pytest.mark.asyncio
async def test_share_invalid_book_returns_400(client):
    token = await _register(client, "shares_badbook@example.com")

    r = await client.post("/api/shares", json={
        "book": "FakeBook", "chapter": 1, "translation": "KJV"
    }, headers=_auth(token))
    assert r.status_code == 400
