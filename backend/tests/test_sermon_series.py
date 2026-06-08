"""Integration tests for /api/sermon-series (preaching series planning)."""

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
async def test_create_and_get_series(client):
    token = await _register(client, "series_create@example.com")
    headers = _auth(token)

    r = await client.post("/api/sermon-series", json={
        "title": "The Sermon on the Mount",
        "theme": "Kingdom ethics in Matthew 5-7",
        "start_date": "2026-09-07",
        "end_date": "2026-11-30",
    }, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "The Sermon on the Mount"
    assert body["entries"] == []
    series_id = body["id"]

    r = await client.get(f"/api/sermon-series/{series_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == series_id


@pytest.mark.asyncio
async def test_list_series_shows_own_series(client):
    token = await _register(client, "series_list@example.com")
    headers = _auth(token)

    await client.post("/api/sermon-series", json={
        "title": "Grace in John", "start_date": "2026-01-01", "end_date": "2026-03-31"
    }, headers=headers)

    r = await client.get("/api/sermon-series", headers=headers)
    assert r.status_code == 200
    titles = [s["title"] for s in r.json()["series"]]
    assert "Grace in John" in titles


@pytest.mark.asyncio
async def test_add_and_update_entry(client):
    token = await _register(client, "series_entry@example.com")
    headers = _auth(token)

    r = await client.post("/api/sermon-series", json={
        "title": "Faith Series", "start_date": "2026-06-01", "end_date": "2026-08-31"
    }, headers=headers)
    series_id = r.json()["id"]

    r = await client.post(f"/api/sermon-series/{series_id}/entries", json={
        "scheduled_date": "2026-06-08",
        "status": "planned",
        "notes": "First sermon on Hebrews 11",
    }, headers=headers)
    assert r.status_code == 200
    body = r.json()
    entry_id = body["id"]
    assert body["status"] == "planned"
    assert body["scheduled_date"] == "2026-06-08"

    r = await client.put(f"/api/sermon-series/{series_id}/entries/{entry_id}", json={
        "status": "preached"
    }, headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "preached"


@pytest.mark.asyncio
async def test_delete_entry(client):
    token = await _register(client, "series_del_entry@example.com")
    headers = _auth(token)

    r = await client.post("/api/sermon-series", json={
        "title": "Delete Test Series", "start_date": "2026-01-01", "end_date": "2026-12-31"
    }, headers=headers)
    series_id = r.json()["id"]

    r = await client.post(f"/api/sermon-series/{series_id}/entries", json={
        "scheduled_date": "2026-07-04", "status": "planned"
    }, headers=headers)
    entry_id = r.json()["id"]

    r = await client.delete(f"/api/sermon-series/{series_id}/entries/{entry_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["deleted"] is True


@pytest.mark.asyncio
async def test_delete_series(client):
    token = await _register(client, "series_delete@example.com")
    headers = _auth(token)

    r = await client.post("/api/sermon-series", json={
        "title": "Temporary Series", "start_date": "2026-01-01", "end_date": "2026-06-30"
    }, headers=headers)
    series_id = r.json()["id"]

    r = await client.delete(f"/api/sermon-series/{series_id}", headers=headers)
    assert r.status_code == 200

    r = await client.get(f"/api/sermon-series/{series_id}", headers=headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_user_isolation(client):
    token_a = await _register(client, "series_iso_a@example.com")
    token_b = await _register(client, "series_iso_b@example.com")

    r = await client.post("/api/sermon-series", json={
        "title": "Private Series", "start_date": "2026-01-01", "end_date": "2026-12-31"
    }, headers=_auth(token_a))
    series_id = r.json()["id"]

    # User B cannot access user A's series
    r = await client.get(f"/api/sermon-series/{series_id}", headers=_auth(token_b))
    assert r.status_code == 404

    # User B sees empty list
    r = await client.get("/api/sermon-series", headers=_auth(token_b))
    assert r.json()["series"] == []


@pytest.mark.asyncio
async def test_invalid_entry_status_rejected(client):
    token = await _register(client, "series_badstatus@example.com")
    headers = _auth(token)

    r = await client.post("/api/sermon-series", json={
        "title": "Status Test", "start_date": "2026-01-01", "end_date": "2026-12-31"
    }, headers=headers)
    series_id = r.json()["id"]

    r = await client.post(f"/api/sermon-series/{series_id}/entries", json={
        "scheduled_date": "2026-06-01", "status": "invalid_status"
    }, headers=headers)
    assert r.status_code == 400
