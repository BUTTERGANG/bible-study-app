"""Integration tests for /api/streaks (reading streak tracking)."""

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
async def test_get_streak_initial_state(client):
    token = await _register(client, "streak_init@example.com")
    r = await client.get("/api/streaks", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["current_streak"] == 0
    assert body["longest_streak"] == 0
    assert body["badges"] == []
    assert body["today_completed"] is False


@pytest.mark.asyncio
async def test_record_completion_increments_streak(client):
    token = await _register(client, "streak_record@example.com")

    r = await client.post("/api/streaks/record", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["current_streak"] == 1
    assert body["already_recorded"] is False
    assert body["longest_streak"] == 1


@pytest.mark.asyncio
async def test_record_same_day_is_idempotent(client):
    token = await _register(client, "streak_idem@example.com")

    r1 = await client.post("/api/streaks/record", headers=_auth(token))
    assert r1.json()["already_recorded"] is False

    r2 = await client.post("/api/streaks/record", headers=_auth(token))
    assert r2.status_code == 200
    assert r2.json()["already_recorded"] is True
    assert r2.json()["current_streak"] == 1


@pytest.mark.asyncio
async def test_streak_reflected_in_get(client):
    token = await _register(client, "streak_get@example.com")

    await client.post("/api/streaks/record", headers=_auth(token))

    r = await client.get("/api/streaks", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["current_streak"] == 1
    assert body["today_completed"] is True


@pytest.mark.asyncio
async def test_share_streak_returns_text(client):
    token = await _register(client, "streak_share@example.com")

    await client.post("/api/streaks/record", headers=_auth(token))

    r = await client.get("/api/streaks/share", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert "current_streak" in body
    assert "share_text" in body
    assert "Bible reading streak" in body["share_text"]
