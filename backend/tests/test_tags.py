"""Integration tests for /api/tags (community passage tags)."""

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
async def test_create_and_list_tag(client):
    token = await _register(client, "tags_create@example.com")
    headers = _auth(token)

    r = await client.post("/api/tags", json={
        "book": "John", "chapter": 3, "verse": 16, "tag_text": "salvation"
    }, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["tag_text"] == "salvation"
    assert body["is_own"] is True
    assert body["upvotes"] == 0
    tag_id = body["id"]

    r = await client.get("/api/tags?book=John&chapter=3&verse=16", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert any(t["id"] == tag_id for t in body["tags"])
    assert "tag_cloud" in body


@pytest.mark.asyncio
async def test_upvote_tag(client):
    token_a = await _register(client, "tags_upvote_a@example.com")
    token_b = await _register(client, "tags_upvote_b@example.com")

    r = await client.post("/api/tags", json={
        "book": "John", "chapter": 3, "verse": 17, "tag_text": "grace"
    }, headers=_auth(token_a))
    tag_id = r.json()["id"]

    # User B upvotes
    r = await client.post(f"/api/tags/{tag_id}/upvote", headers=_auth(token_b))
    assert r.status_code == 200
    assert r.json()["upvotes"] == 1
    assert r.json()["already_upvoted"] is False

    # User B upvotes again — idempotent
    r = await client.post(f"/api/tags/{tag_id}/upvote", headers=_auth(token_b))
    assert r.json()["upvotes"] == 1
    assert r.json()["already_upvoted"] is True


@pytest.mark.asyncio
async def test_delete_own_tag(client):
    token = await _register(client, "tags_delete@example.com")
    headers = _auth(token)

    r = await client.post("/api/tags", json={
        "book": "Genesis", "chapter": 1, "verse": 1, "tag_text": "creation"
    }, headers=headers)
    tag_id = r.json()["id"]

    r = await client.delete(f"/api/tags/{tag_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["deleted"] is True


@pytest.mark.asyncio
async def test_delete_other_users_tag_forbidden(client):
    token_a = await _register(client, "tags_own_a@example.com")
    token_b = await _register(client, "tags_own_b@example.com")

    r = await client.post("/api/tags", json={
        "book": "John", "chapter": 1, "verse": 1, "tag_text": "logos"
    }, headers=_auth(token_a))
    tag_id = r.json()["id"]

    r = await client.delete(f"/api/tags/{tag_id}", headers=_auth(token_b))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_search_by_tag(client):
    token = await _register(client, "tags_search@example.com")
    headers = _auth(token)

    await client.post("/api/tags", json={
        "book": "John", "chapter": 3, "verse": 16, "tag_text": "gospel-unique-search"
    }, headers=headers)

    r = await client.get("/api/tags/search?q=gospel-unique-search", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    refs = [item["book"] for item in body["results"]]
    assert "John" in refs


@pytest.mark.asyncio
async def test_create_tag_requires_passage_or_resource(client):
    token = await _register(client, "tags_missing@example.com")

    r = await client.post("/api/tags", json={"tag_text": "floating"}, headers=_auth(token))
    assert r.status_code == 400
