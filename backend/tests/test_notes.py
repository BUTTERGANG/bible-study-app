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
