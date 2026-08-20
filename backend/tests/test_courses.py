"""Integration tests for /api/courses (original language courses)."""

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
async def test_list_courses_returns_greek_and_hebrew(client):
    r = await client.get("/api/courses")
    assert r.status_code == 200
    body = r.json()
    languages = [c["language"] for c in body["courses"]]
    assert "greek" in languages
    assert "hebrew" in languages


@pytest.mark.asyncio
async def test_get_greek_course_has_unit1(client):
    r = await client.get("/api/courses/greek")
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == "greek"
    assert len(body["units"]) >= 1
    unit1 = body["units"][0]
    assert unit1["unit_number"] == 1
    assert len(unit1["lessons"]) >= 2


@pytest.mark.asyncio
async def test_get_hebrew_course_has_unit1(client):
    r = await client.get("/api/courses/hebrew")
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == "hebrew"
    assert len(body["units"]) >= 1


@pytest.mark.asyncio
async def test_get_greek_lesson1_has_exercises(client):
    r = await client.get("/api/courses/greek/units/1/lessons/1")
    assert r.status_code == 200
    body = r.json()
    assert body["lesson_number"] == 1
    assert "instruction" in body
    assert "paradigm_table" in body
    assert isinstance(body["paradigm_table"], list)
    assert len(body["exercises"]) >= 24  # 24 alphabet flashcards
    # Verify exercise structure
    ex = body["exercises"][0]
    assert "exercise_type" in ex
    assert "prompt" in ex
    assert "answer" in ex


@pytest.mark.asyncio
async def test_get_hebrew_lesson1_has_22_flashcards(client):
    r = await client.get("/api/courses/hebrew/units/1/lessons/1")
    assert r.status_code == 200
    flashcards = [e for e in r.json()["exercises"] if e["exercise_type"] == "flashcard"]
    assert len(flashcards) == 22  # Hebrew alphabet has 22 letters


@pytest.mark.asyncio
async def test_unknown_language_returns_404(client):
    r = await client.get("/api/courses/latin")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_unknown_unit_returns_404(client):
    r = await client.get("/api/courses/greek/units/99")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_progress_initial_state(client):
    token = await _register(client, "courses_progress@example.com")
    r = await client.get("/api/courses/greek/progress", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["current_unit"] == 1
    assert body["current_lesson"] == 1
    assert body["percent_complete"] == 0.0
    assert body["current_streak"] == 0


@pytest.mark.asyncio
async def test_update_progress(client):
    token = await _register(client, "courses_update@example.com")
    headers = _auth(token)

    # Fetch lesson 1 to get its ID
    lesson_r = await client.get("/api/courses/greek/units/1/lessons/1")
    lesson_id = lesson_r.json()["id"]

    r = await client.post("/api/courses/greek/progress", json={
        "current_unit": 1,
        "current_lesson": 2,
        "completed_lesson_id": lesson_id,
        "total_lessons": 4,
    }, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["current_lesson"] == 2
    assert lesson_id in body["completed_lesson_ids"]
    assert body["percent_complete"] == 25.0
    assert body["current_streak"] == 1
