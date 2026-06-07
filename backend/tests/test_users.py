"""Integration tests for the /api/users endpoints.

Covers: register, duplicate-email rejection, login, wrong-password rejection,
/me with a valid JWT, /me in open-auth mode, token refresh, and the
per-minute rate limit on auth endpoints.

The conftest sets APP_PASSWORD="" (open mode), so get_current_user falls
through to id=0/legacy for unauthenticated calls.  To exercise the real JWT
path we register a user and pass the returned access token as a Bearer header.
"""

import pytest

import backend.rate_limit as _rl


def _clear_auth_buckets():
    """Wipe in-process auth rate-limit state between tests."""
    _rl._auth_buckets.clear()


# ── Registration ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_returns_201_with_tokens(client):
    _clear_auth_buckets()
    r = await client.post(
        "/api/users/register",
        json={"email": "alice@example.com", "password": "securepass1"},
    )
    assert r.status_code == 201
    body = r.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "alice@example.com"
    assert isinstance(body["user"]["id"], int)


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_400(client):
    _clear_auth_buckets()
    payload = {"email": "bob@example.com", "password": "pass1234"}
    r1 = await client.post("/api/users/register", json=payload)
    assert r1.status_code == 201

    _clear_auth_buckets()
    r2 = await client.post("/api/users/register", json=payload)
    assert r2.status_code == 400
    assert "already registered" in r2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_email_is_lowercased(client):
    _clear_auth_buckets()
    r = await client.post(
        "/api/users/register",
        json={"email": "Charlie@Example.COM", "password": "pass5678"},
    )
    assert r.status_code == 201
    assert r.json()["user"]["email"] == "charlie@example.com"


# ── Login ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_correct_credentials_returns_200_with_tokens(client):
    _clear_auth_buckets()
    await client.post(
        "/api/users/register",
        json={"email": "dave@example.com", "password": "mypassword"},
    )

    _clear_auth_buckets()
    r = await client.post(
        "/api/users/login",
        json={"email": "dave@example.com", "password": "mypassword"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client):
    _clear_auth_buckets()
    await client.post(
        "/api/users/register",
        json={"email": "eve@example.com", "password": "correctpass"},
    )

    _clear_auth_buckets()
    r = await client.post(
        "/api/users/login",
        json={"email": "eve@example.com", "password": "wrongpass"},
    )
    assert r.status_code == 401
    assert "invalid" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_nonexistent_user_returns_401(client):
    _clear_auth_buckets()
    r = await client.post(
        "/api/users/login",
        json={"email": "nobody@example.com", "password": "whatever"},
    )
    assert r.status_code == 401


# ── /me endpoint ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_me_with_valid_jwt_returns_user(client):
    _clear_auth_buckets()
    reg = await client.post(
        "/api/users/register",
        json={"email": "frank@example.com", "password": "testpass"},
    )
    assert reg.status_code == 201
    access_token = reg.json()["access_token"]

    r = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "frank@example.com"
    assert body["is_legacy"] is False


@pytest.mark.asyncio
async def test_me_without_token_open_auth_returns_legacy_user(client):
    """With APP_PASSWORD="" get_current_user falls through to open mode
    (id=0, is_legacy=True), so /me should return the legacy sentinel."""
    r = await client.get("/api/users/me")
    assert r.status_code == 200
    body = r.json()
    assert body["is_legacy"] is True
    assert body["id"] == 0


# ── Token refresh ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_refresh_token_returns_new_access_and_refresh(client):
    _clear_auth_buckets()
    reg = await client.post(
        "/api/users/register",
        json={"email": "grace@example.com", "password": "refreshme"},
    )
    assert reg.status_code == 201
    original_refresh = reg.json()["refresh_token"]

    _clear_auth_buckets()
    r = await client.post(
        "/api/users/refresh",
        json={"refresh_token": original_refresh},
    )
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"
    # New tokens must differ from the originals (different exp claim)
    assert body["access_token"] != reg.json()["access_token"]


@pytest.mark.asyncio
async def test_refresh_with_invalid_token_returns_401(client):
    _clear_auth_buckets()
    r = await client.post(
        "/api/users/refresh",
        json={"refresh_token": "this.is.not.a.valid.jwt"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh_with_access_token_instead_of_refresh_returns_401(client):
    """Passing an access token where a refresh token is expected must be rejected."""
    _clear_auth_buckets()
    reg = await client.post(
        "/api/users/register",
        json={"email": "henry@example.com", "password": "mixedtokens"},
    )
    access_token = reg.json()["access_token"]

    _clear_auth_buckets()
    r = await client.post(
        "/api/users/refresh",
        json={"refresh_token": access_token},
    )
    assert r.status_code == 401


# ── Rate limiting ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sixth_login_attempt_in_one_minute_returns_429(client):
    """AUTH_RATE_LIMIT_PER_MIN defaults to 5; the 6th attempt must be 429."""
    _clear_auth_buckets()
    # Exhaust the 5-per-minute allowance with login attempts.
    for _ in range(5):
        await client.post(
            "/api/users/login",
            json={"email": "ratelimit@example.com", "password": "anything"},
        )

    # The 6th call must be rejected regardless of credentials.
    r = await client.post(
        "/api/users/login",
        json={"email": "ratelimit@example.com", "password": "anything"},
    )
    assert r.status_code == 429
