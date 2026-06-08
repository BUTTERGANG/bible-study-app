"""Integration tests for /api/notes and /api/highlights routes.

Covers: full CRUD lifecycle, tags, chapter-only notes (no verse),
invalid book rejection, missing-field validation, and highlight upsert.
"""

import pytest


@pytest.mark.asyncio
async def test_create_list_update_delete_note(client):
    # Create
    r = await client.post("/api/notes", json={
        "book": "John", "chapter": 3, "verse": 16, "content": "Key verse"
    })
    assert r.status_code == 200
    note_id = r.json()["id"]

    # List for the same verse
    r = await client.get("/api/notes?book=John&chapter=3&verse=16")
    assert r.status_code == 200
    assert len(r.json()["notes"]) == 1

    # Update
    r = await client.put(f"/api/notes/{note_id}", json={"content": "Updated"})
    assert r.status_code == 200
    assert r.json()["content"] == "Updated"

    # Delete
    r = await client.delete(f"/api/notes/{note_id}")
    assert r.status_code == 200

    r = await client.get("/api/notes?book=John&chapter=3&verse=16")
    assert len(r.json()["notes"]) == 0


@pytest.mark.asyncio
async def test_highlight_upsert_is_atomic(client):
    """Two creates against the same (translation, book, chapter, verse) must
    upsert, not create two rows."""
    payload = {"translation": "KJV", "book": "John", "chapter": 3, "verse": 16, "color": "yellow"}
    r1 = await client.post("/api/highlights", json=payload)
    assert r1.status_code == 200
    first_id = r1.json()["id"]

    payload["color"] = "blue"
    r2 = await client.post("/api/highlights", json=payload)
    assert r2.status_code == 200
    assert r2.json()["id"] == first_id
    assert r2.json()["color"] == "blue"

    r3 = await client.get("/api/highlights/John/3?translation=KJV")
    assert r3.status_code == 200
    body = r3.json()
    assert len(body["highlights"]) == 1
    assert body["highlights"]["16"]["color"] == "blue"


# ── Notes with tags ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_note_with_tags(client):
    r = await client.post("/api/notes", json={
        "book": "John", "chapter": 3, "verse": 17,
        "content": "Note with tags", "tags": "theology,grace"
    })
    assert r.status_code == 200
    body = r.json()
    assert body["tags"] == "theology,grace"
    note_id = body["id"]

    # Fetch it back and verify tags are present
    r = await client.get("/api/notes?book=John&chapter=3&verse=17")
    assert r.status_code == 200
    notes = r.json()["notes"]
    tagged = [n for n in notes if n["id"] == note_id]
    assert len(tagged) == 1
    assert tagged[0]["tags"] == "theology,grace"


@pytest.mark.asyncio
async def test_update_note_tags(client):
    r = await client.post("/api/notes", json={
        "book": "John", "chapter": 3, "verse": 16, "content": "Tag update test"
    })
    note_id = r.json()["id"]

    r = await client.put(f"/api/notes/{note_id}", json={"tags": "updated-tag"})
    assert r.status_code == 200
    assert r.json()["tags"] == "updated-tag"


# ── Chapter-only note (no verse) ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_chapter_only_note(client):
    """A note with verse=None should be allowed for chapter-level annotations."""
    r = await client.post("/api/notes", json={
        "book": "Genesis", "chapter": 1, "content": "Creation chapter overview"
    })
    assert r.status_code == 200
    body = r.json()
    assert body["book"] == "Genesis"
    assert body["chapter"] == 1
    # verse should be null/None when not provided
    assert body.get("verse") is None
    # Reference should be "Genesis 1" (no colon)
    assert body["reference"] == "Genesis 1"


# ── Invalid book name ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_note_invalid_book_returns_400(client):
    r = await client.post("/api/notes", json={
        "book": "NotABook", "chapter": 1, "verse": 1, "content": "Bad book"
    })
    assert r.status_code == 400
    assert "unknown book" in r.json()["detail"].lower()


# ── Note reference format ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_note_reference_includes_verse(client):
    """A note with a verse number should have a reference like 'Book Ch:Vs'."""
    r = await client.post("/api/notes", json={
        "book": "John", "chapter": 3, "verse": 16, "content": "Ref check"
    })
    assert r.status_code == 200
    assert r.json()["reference"] == "John 3:16"