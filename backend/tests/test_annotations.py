"""Integration tests for /api/annotations (inline word/phrase annotations)."""

import pytest


@pytest.mark.asyncio
async def test_create_list_update_delete_annotation(client):
    r = await client.post("/api/annotations", json={
        "book": "John", "chapter": 3, "verse": 16,
        "word_start": 0, "word_end": 2,
        "content": "Key phrase", "color": "yellow",
    })
    assert r.status_code == 200
    body = r.json()
    ann_id = body["id"]
    assert body["word_start"] == 0
    assert body["word_end"] == 2
    assert body["color"] == "yellow"

    r = await client.get("/api/annotations?book=John&chapter=3&verse=16")
    assert r.status_code == 200
    assert len(r.json()["annotations"]) >= 1

    r = await client.put(f"/api/annotations/{ann_id}", json={"color": "blue", "content": "Updated"})
    assert r.status_code == 200
    assert r.json()["color"] == "blue"
    assert r.json()["content"] == "Updated"

    r = await client.delete(f"/api/annotations/{ann_id}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True


@pytest.mark.asyncio
async def test_list_annotations_chapter_scope(client):
    """Listing without verse= should return all annotations in the chapter."""
    await client.post("/api/annotations", json={
        "book": "Genesis", "chapter": 1, "verse": 1,
        "word_start": 0, "word_end": 0, "content": "Creation note",
    })
    await client.post("/api/annotations", json={
        "book": "Genesis", "chapter": 1, "verse": 2,
        "word_start": 1, "word_end": 3, "content": "Spirit note",
    })

    r = await client.get("/api/annotations?book=Genesis&chapter=1")
    assert r.status_code == 200
    assert len(r.json()["annotations"]) >= 2


@pytest.mark.asyncio
async def test_annotation_invalid_word_range_rejected(client):
    r = await client.post("/api/annotations", json={
        "book": "John", "chapter": 3, "verse": 16,
        "word_start": 5, "word_end": 2,  # end < start
        "content": "Bad range",
    })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_delete_nonexistent_annotation_returns_404(client):
    r = await client.delete("/api/annotations/999999")
    assert r.status_code == 404
