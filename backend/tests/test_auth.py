"""Tests for auth behavior.

Part 1 (unit): Auth module behavior with APP_PASSWORD env var manipulation.
These tests reach into the auth module directly.

Part 2 (integration): HTTP-level login endpoint tests via /api/users/login.
These exercise the full FastAPI request pipeline including rate limiting,
password hashing, and JWT token generation.
"""

import pytest
from fastapi import HTTPException

import backend.rate_limit as _rl
from backend.auth import auth_is_enabled, get_current_user


def test_auth_disabled_when_unset(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "")
    assert auth_is_enabled() is False


def test_auth_enabled_when_set(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "letmein")
    assert auth_is_enabled() is True


@pytest.mark.asyncio
async def test_missing_password_raises(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "letmein")
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization=None, x_app_password=None, db=None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_bearer_password_accepted(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "letmein")
    user = await get_current_user(authorization="Bearer letmein", x_app_password=None, db=None)
    assert user.id == 0
    assert user.is_legacy is True


@pytest.mark.asyncio
async def test_header_password_accepted(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "letmein")
    user = await get_current_user(authorization=None, x_app_password="letmein", db=None)
    assert user.id == 0
    assert user.is_legacy is True


@pytest.mark.asyncio
async def test_wrong_password_rejected(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "letmein")
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Bearer nope", x_app_password=None, db=None)
    assert exc.value.status_code == 401


# ── Integration: HTTP-level /api/users/login ─────────────────────────────


def _clear_auth_buckets():
    _rl._auth_buckets.clear()


@pytest.mark.asyncio
async def test_login_endpoint_returns_tokens(client):
    _clear_auth_buckets()
    await client.post("/api/users/register", json={"email": "logintest@example.com", "password": "mypass123"})
    _clear_auth_buckets()
    r = await client.post("/api/users/login", json={"email": "logintest@example.com", "password": "mypass123"})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"
    assert "user" in body
    assert body["user"]["email"] == "logintest@example.com"


@pytest.mark.asyncio
async def test_login_case_insensitive_email(client):
    _clear_auth_buckets()
    await client.post("/api/users/register", json={"email": "casetest@example.com", "password": "casepass"})
    _clear_auth_buckets()
    r = await client.post("/api/users/login", json={"email": "CaseTest@EXAMPLE.COM", "password": "casepass"})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "casetest@example.com"


@pytest.mark.asyncio
async def test_login_missing_fields_returns_422(client):
    _clear_auth_buckets()
    r = await client.post("/api/users/login", json={"email": "no@password.com"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_login_empty_body_returns_422(client):
    _clear_auth_buckets()
    r = await client.post("/api/users/login", json={})
    assert r.status_code == 422
