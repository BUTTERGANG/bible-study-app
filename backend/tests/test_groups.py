"""Integration tests for the /api/groups endpoints.

Covers: create, list (member isolation), get detail (non-member rejection),
owner-invites-member (auto-add), non-owner update rejection, and owner delete.

Groups are mounted with dependencies=_protected, so every request goes through
get_current_user.  With APP_PASSWORD="" the app is in open mode: an
unauthenticated call resolves to id=0 (legacy).  To test multi-user ACL we
register two real users, capture their JWT access tokens, and pass them in the
Authorization header so each call resolves to a different user identity.
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
async def test_create_group_returns_201_and_owner_is_member(client):
    token = await _register(client, "owner1@example.com")

    r = await client.post(
        "/api/groups",
        json={"name": "Bible Study Alpha", "description": "Morning group"},
        headers=_auth(token),
    )
    assert r.status_code == 200  # router uses default 200 (no explicit status_code=201)
    body = r.json()
    assert body["name"] == "Bible Study Alpha"
    assert body["member_count"] == 1
    assert "id" in body
    assert "invite_code" in body


@pytest.mark.asyncio
async def test_create_group_with_no_description(client):
    token = await _register(client, "owner2@example.com")

    r = await client.post(
        "/api/groups",
        json={"name": "Minimal Group"},
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Minimal Group"


# ── List ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_groups_only_returns_groups_user_is_member_of(client):
    token_a = await _register(client, "lista@example.com")
    token_b = await _register(client, "listb@example.com")

    # User A creates a group
    r = await client.post(
        "/api/groups",
        json={"name": "Group for A only"},
        headers=_auth(token_a),
    )
    assert r.status_code == 200

    # User B should see an empty list — they joined no group
    r = await client.get("/api/groups", headers=_auth(token_b))
    assert r.status_code == 200
    assert r.json()["groups"] == []


@pytest.mark.asyncio
async def test_list_groups_shows_groups_user_created(client):
    token = await _register(client, "creator@example.com")

    await client.post(
        "/api/groups",
        json={"name": "My Study Circle"},
        headers=_auth(token),
    )

    r = await client.get("/api/groups", headers=_auth(token))
    assert r.status_code == 200
    names = [g["name"] for g in r.json()["groups"]]
    assert "My Study Circle" in names


# ── Get detail (member-only) ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_non_member_cannot_get_group_detail(client):
    token_owner = await _register(client, "groupowner@example.com")
    token_outsider = await _register(client, "outsider@example.com")

    r = await client.post(
        "/api/groups",
        json={"name": "Private Group"},
        headers=_auth(token_owner),
    )
    group_id = r.json()["id"]

    # Outsider tries to fetch the group — must be denied
    r = await client.get(f"/api/groups/{group_id}", headers=_auth(token_outsider))
    # The router raises 403 (not a member), not 404 — but either 403 or 404
    # is acceptable here; the key requirement is the user cannot see the group.
    assert r.status_code in (403, 404)


@pytest.mark.asyncio
async def test_member_can_get_group_detail(client):
    token = await _register(client, "memberdetail@example.com")

    r = await client.post(
        "/api/groups",
        json={"name": "Visible Group"},
        headers=_auth(token),
    )
    group_id = r.json()["id"]

    r = await client.get(f"/api/groups/{group_id}", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == group_id
    assert "members" in body


# ── Invite ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_owner_can_invite_existing_user_who_is_auto_added(client):
    token_owner = await _register(client, "invowner@example.com")
    # Ensure the invited user already exists
    await _register(client, "invitee@example.com")

    r = await client.post(
        "/api/groups",
        json={"name": "Invite Test Group"},
        headers=_auth(token_owner),
    )
    group_id = r.json()["id"]

    r = await client.post(
        f"/api/groups/{group_id}/invites",
        json={"email": "invitee@example.com"},
        headers=_auth(token_owner),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["auto_added"] is True  # user already in DB → auto-added

    # Group detail should now show 2 members
    r = await client.get(f"/api/groups/{group_id}", headers=_auth(token_owner))
    member_emails = [m["email"] for m in r.json()["members"]]
    assert "invitee@example.com" in member_emails


@pytest.mark.asyncio
async def test_non_owner_cannot_invite(client):
    token_owner = await _register(client, "invowner2@example.com")
    token_member_email = "premember@example.com"
    token_member = await _register(client, token_member_email)

    r = await client.post(
        "/api/groups",
        json={"name": "ACL Invite Group"},
        headers=_auth(token_owner),
    )
    group_id = r.json()["id"]

    # Manually add the non-owner as a member via invite
    await client.post(
        f"/api/groups/{group_id}/invites",
        json={"email": token_member_email},
        headers=_auth(token_owner),
    )

    # Non-owner tries to invite a third party
    r = await client.post(
        f"/api/groups/{group_id}/invites",
        json={"email": "thirdparty@example.com"},
        headers=_auth(token_member),
    )
    assert r.status_code == 403


# ── Update ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_owner_can_update_group_name(client):
    token = await _register(client, "updateowner@example.com")

    r = await client.post(
        "/api/groups",
        json={"name": "Old Name"},
        headers=_auth(token),
    )
    group_id = r.json()["id"]

    r = await client.put(
        f"/api/groups/{group_id}",
        json={"name": "New Name"},
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_non_owner_cannot_update_group_name(client):
    token_owner = await _register(client, "updateowner2@example.com")
    token_other = await _register(client, "otherupdate@example.com")

    r = await client.post(
        "/api/groups",
        json={"name": "Protected Group"},
        headers=_auth(token_owner),
    )
    group_id = r.json()["id"]

    r = await client.put(
        f"/api/groups/{group_id}",
        json={"name": "Hijacked Name"},
        headers=_auth(token_other),
    )
    assert r.status_code == 403


# ── Delete ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_owner_can_delete_group(client):
    token = await _register(client, "deleteowner@example.com")

    r = await client.post(
        "/api/groups",
        json={"name": "Temporary Group"},
        headers=_auth(token),
    )
    group_id = r.json()["id"]

    r = await client.delete(f"/api/groups/{group_id}", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # The group is gone — fetching it should be 403 (no membership) or 404
    r = await client.get(f"/api/groups/{group_id}", headers=_auth(token))
    assert r.status_code in (403, 404)


@pytest.mark.asyncio
async def test_non_owner_cannot_delete_group(client):
    token_owner = await _register(client, "delowner2@example.com")
    token_other = await _register(client, "delother@example.com")

    r = await client.post(
        "/api/groups",
        json={"name": "Sturdy Group"},
        headers=_auth(token_owner),
    )
    group_id = r.json()["id"]

    r = await client.delete(f"/api/groups/{group_id}", headers=_auth(token_other))
    assert r.status_code == 403
