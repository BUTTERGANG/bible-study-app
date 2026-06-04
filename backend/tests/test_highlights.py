"""Integration tests for the /api/highlights endpoints.

Covers: create, get chapter highlights, user isolation (different user cannot
see first user's highlights), and delete.

Highlights are mounted with dependencies=_protected, so get_current_user
always runs.  In open mode (APP_PASSWORD="") with no Authorization header
the resolved user is id=0 (legacy).  To test isolation between two real users
we register them and pass their JWT access tokens.
"""

import pytest

import backend.rate_limit as _rl


def _clear_auth_buckets():
    _rl._auth_buckets.clear()


async def _register(client, email: str, password: str = "testpassword") -> str:
    """Register a user and return their access token."""
    _clear_auth_buckets()
    r = await client.post(
        "/api/users/register",
        json={"email": email, "password": password},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Create ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_highlight_returns_id_and_color(client):
    token = await _register(client, "hlcreate@example.com")

    r = await client.post(
        "/api/highlights",
        json={
            "translation": "KJV",
            "book": "John",
            "chapter": 3,
            "verse": 16,
            "color": "yellow",
        },
        headers=_auth(token),
    )
    assert r.status_code == 200
    body = r.json()
    assert "id" in body
    assert body["color"] == "yellow"


@pytest.mark.asyncio
async def test_create_highlight_default_color_is_yellow(client):
    token = await _register(client, "hldefault@example.com")

    r = await client.post(
        "/api/highlights",
        json={
            "translation": "KJV",
            "book": "John",
            "chapter": 3,
            "verse": 17,
        },
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["color"] == "yellow"


@pytest.mark.asyncio
async def test_create_highlight_unknown_book_returns_400(client):
    token = await _register(client, "hlbadbook@example.com")

    r = await client.post(
        "/api/highlights",
        json={
            "translation": "KJV",
            "book": "NotABook",
            "chapter": 1,
            "verse": 1,
            "color": "blue",
        },
        headers=_auth(token),
    )
    assert r.status_code == 400


# ── Get chapter highlights ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_chapter_highlights_includes_created_highlight(client):
    token = await _register(client, "hlget@example.com")

    await client.post(
        "/api/highlights",
        json={"translation": "KJV", "book": "John", "chapter": 3, "verse": 16, "color": "green"},
        headers=_auth(token),
    )

    r = await client.get(
        "/api/highlights/John/3?translation=KJV",
        headers=_auth(token),
    )
    assert r.status_code == 200
    body = r.json()
    assert "highlights" in body
    # Verse 16 must appear
    assert "16" in body["highlights"]
    assert body["highlights"]["16"]["color"] == "green"


@pytest.mark.asyncio
async def test_get_chapter_highlights_empty_before_any_created(client):
    token = await _register(client, "hlgetblank@example.com")

    r = await client.get(
        "/api/highlights/Genesis/1?translation=KJV",
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["highlights"] == {}


@pytest.mark.asyncio
async def test_get_chapter_highlights_unknown_book_returns_404(client):
    token = await _register(client, "hlbooknotfound@example.com")

    r = await client.get(
        "/api/highlights/NotABook/1",
        headers=_auth(token),
    )
    assert r.status_code == 404


# ── User isolation ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_different_user_cannot_see_first_users_highlights(client):
    token_a = await _register(client, "hlisola@example.com")
    token_b = await _register(client, "hlisolb@example.com")

    # User A creates a highlight on John 3:16
    await client.post(
        "/api/highlights",
        json={"translation": "KJV", "book": "John", "chapter": 3, "verse": 16, "color": "pink"},
        headers=_auth(token_a),
    )

    # User B fetches the same chapter — should see no highlights
    r = await client.get(
        "/api/highlights/John/3?translation=KJV",
        headers=_auth(token_b),
    )
    assert r.status_code == 200
    assert "16" not in r.json()["highlights"]


# ── Delete ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_highlight_removes_it_from_chapter(client):
    token = await _register(client, "hldelete@example.com")

    # Create
    r = await client.post(
        "/api/highlights",
        json={"translation": "KJV", "book": "John", "chapter": 3, "verse": 16, "color": "blue"},
        headers=_auth(token),
    )
    highlight_id = r.json()["id"]

    # Delete
    r = await client.delete(f"/api/highlights/{highlight_id}", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # Confirm it is gone
    r = await client.get(
        "/api/highlights/John/3?translation=KJV",
        headers=_auth(token),
    )
    assert "16" not in r.json()["highlights"]


@pytest.mark.asyncio
async def test_delete_nonexistent_highlight_returns_404(client):
    token = await _register(client, "hldelnotfound@example.com")

    r = await client.delete("/api/highlights/999999", headers=_auth(token))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_user_cannot_delete_another_users_highlight(client):
    token_a = await _register(client, "hldela@example.com")
    token_b = await _register(client, "hldelb@example.com")

    # User A creates a highlight
    r = await client.post(
        "/api/highlights",
        json={"translation": "KJV", "book": "John", "chapter": 3, "verse": 16, "color": "orange"},
        headers=_auth(token_a),
    )
    highlight_id = r.json()["id"]

    # User B attempts to delete it — must fail (rowcount 0 → 404)
    r = await client.delete(f"/api/highlights/{highlight_id}", headers=_auth(token_b))
    assert r.status_code == 404

    # User A's highlight is still intact
    r = await client.get(
        "/api/highlights/John/3?translation=KJV",
        headers=_auth(token_a),
    )
    assert "16" in r.json()["highlights"]
