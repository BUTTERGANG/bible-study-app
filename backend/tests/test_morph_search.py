"""Tests for the morphological search endpoint."""

import os
import sqlite3
from pathlib import Path

import pytest


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def seed_word_tables(client):
    """Seed greek_words and hebrew_words tables with test data."""
    data_path = os.environ.get("DATA_PATH", "")
    db_path = Path(data_path) / "bible.db"
    if not db_path.exists():
        yield
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Drop and recreate word tables to ensure clean schema
    cur.executescript("""
        DROP TABLE IF EXISTS greek_words;
        DROP TABLE IF EXISTS hebrew_words;
        CREATE TABLE greek_words (
            id INTEGER PRIMARY KEY,
            book TEXT,
            book_num INTEGER,
            chapter INTEGER,
            verse INTEGER,
            word_position INTEGER,
            greek TEXT,
            transliteration TEXT,
            morphology TEXT,
            strongs_num TEXT,
            english_gloss TEXT
        );
        CREATE TABLE hebrew_words (
            id INTEGER PRIMARY KEY,
            book TEXT,
            book_num INTEGER,
            chapter INTEGER,
            verse INTEGER,
            word_position INTEGER,
            hebrew TEXT,
            transliteration TEXT,
            morphology TEXT,
            strongs_num TEXT,
            english_gloss TEXT
        );
    """)

    # Seed Greek words for John 3:16-17
    greek_data = [
        ("John", 43, 3, 16, 1, "ἠγάπησεν", "ēgapēsen", "V-AAI-3S", "G25", "loved"),
        ("John", 43, 3, 16, 2, "θεός", "theos", "N-NSM", "G2316", "God"),
        ("John", 43, 3, 16, 3, "κόσμον", "kosmon", "N-ASM", "G2889", "world"),
        ("John", 43, 3, 16, 4, "ἔδωκεν", "edōken", "V-AAI-3S", "G1325", "gave"),
        ("John", 43, 3, 16, 5, "υἱόν", "huion", "N-ASM", "G5207", "Son"),
        ("John", 43, 3, 16, 6, "μονογενῆ", "monogenē", "A-ASM", "G3439", "only begotten"),
        ("John", 43, 3, 16, 7, "πιστεύων", "pisteuōn", "V-PAP-NSM", "G4100", "believing"),
        ("John", 43, 3, 16, 8, "ἀπόληται", "apolētai", "V-AMS-3S", "G622", "perish"),
        ("John", 43, 3, 16, 9, "ζωὴν", "zōēn", "N-ASF", "G2222", "life"),
        ("John", 43, 3, 16, 10, "αἰώνιον", "aiōnion", "A-ASF", "G166", "eternal"),
        ("John", 43, 3, 17, 1, "ἀπέστειλεν", "apesteilen", "V-AAI-3S", "G649", "sent"),
        ("John", 43, 3, 17, 2, "κρίνῃ", "krinē", "V-PAS-3S", "G2919", "judge"),
        ("John", 43, 3, 17, 3, "σωθῇ", "sōthē", "V-APS-3S", "G4982", "saved"),
    ]

    # Seed Hebrew words for Genesis 1:1
    hebrew_data = [
        ("Genesis", 1, 1, 1, 1, "בָּרָא", "bārāʾ", "V-Qal-3ms", "G1254", "created"),
        ("Genesis", 1, 1, 1, 2, "אֱלֹהִים", "ʾĕlōhîm", "N-MP", "G430", "God"),
        ("Genesis", 1, 1, 1, 3, "שָׁמַיִם", "šāmayim", "N-MP", "G3772", "heavens"),
        ("Genesis", 1, 1, 1, 4, "אֶרֶץ", "ʾereṣ", "N-FS", "G1093", "earth"),
    ]

    cur.executemany(
        "INSERT INTO greek_words (book, book_num, chapter, verse, word_position, greek, transliteration, morphology, strongs_num, english_gloss) VALUES (?,?,?,?,?,?,?,?,?,?)",
        greek_data,
    )
    cur.executemany(
        "INSERT INTO hebrew_words (book, book_num, chapter, verse, word_position, hebrew, transliteration, morphology, strongs_num, english_gloss) VALUES (?,?,?,?,?,?,?,?,?,?)",
        hebrew_data,
    )
    conn.commit()
    conn.close()
    yield


@pytest.mark.anyio
class TestMorphSearchEndpoint:
    async def test_morph_search_greek_aorist_active(self, client):
        """Search for Greek aorist active indicative verbs (V-AAI)."""
        resp = await client.post("/api/search/morph", json={
            "language": "greek",
            "part_of_speech": "verb",
            "tense": "aorist",
            "voice": "active",
            "mood": "indicative",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] > 0
        for r in data["results"]:
            assert r["morphology"].startswith("V-AAI")

    async def test_morph_search_greek_present_participle(self, client):
        """Search for Greek present active participles (V-PAP)."""
        resp = await client.post("/api/search/morph", json={
            "language": "greek",
            "part_of_speech": "verb",
            "tense": "present",
            "voice": "active",
            "mood": "participle",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] > 0
        for r in data["results"]:
            assert r["morphology"].startswith("V-PAP")

    async def test_morph_search_greek_nominative_noun(self, client):
        """Search for Greek nominative singular masculine nouns."""
        # First check what's in the DB
        resp_all = await client.post("/api/search/morph", json={
            "language": "greek",
            "part_of_speech": "noun",
        })
        data_all = resp_all.json()
        print(f"ALL NOUNS: count={data_all['count']}, results={data_all['results'][:2]}")

        resp = await client.post("/api/search/morph", json={
            "language": "greek",
            "part_of_speech": "noun",
            "case": "nominative",
            "number": "singular",
            "gender": "masculine",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] > 0
        for r in data["results"]:
            assert r["morphology"].startswith("N-NSM")

    async def test_morph_search_greek_3rd_person(self, client):
        """Search for Greek 3rd person verbs."""
        resp = await client.post("/api/search/morph", json={
            "language": "greek",
            "part_of_speech": "verb",
            "person": "3rd",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] > 0
        for r in data["results"]:
            parts = r["morphology"].split("-")
            if len(parts) >= 3:
                assert parts[2].startswith("3")

    async def test_morph_search_greek_subjunctive(self, client):
        """Search for Greek subjunctive mood verbs."""
        resp = await client.post("/api/search/morph", json={
            "language": "greek",
            "part_of_speech": "verb",
            "mood": "subjunctive",
        })
        assert resp.status_code == 200
        data = resp.json()
        for r in data.get("results", []):
            tvm = r["morphology"].split("-")[1]
            assert tvm[2] == "S"

    async def test_morph_search_no_filters(self, client):
        """Empty query should return empty results."""
        resp = await client.post("/api/search/morph", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["results"] == []

    async def test_morph_search_limit(self, client):
        """Limit parameter should cap results."""
        resp = await client.post("/api/search/morph", json={
            "language": "greek",
            "part_of_speech": "verb",
            "limit": 3,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] <= 3

    async def test_morph_search_result_has_required_fields(self, client):
        """Results should include all required fields."""
        resp = await client.post("/api/search/morph", json={
            "language": "greek",
            "part_of_speech": "verb",
            "limit": 1,
        })
        assert resp.status_code == 200
        data = resp.json()
        if data["count"] > 0:
            r = data["results"][0]
            assert "reference" in r
            assert "word" in r
            assert "morphology" in r
            assert "verse_text" in r
            assert "book" in r
            assert "chapter" in r
            assert "verse" in r

    async def test_morph_search_greek_adjective(self, client):
        """Search for Greek adjectives."""
        resp = await client.post("/api/search/morph", json={
            "language": "greek",
            "part_of_speech": "adjective",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] > 0
        for r in data["results"]:
            assert r["morphology"].startswith("A-")

    async def test_morph_search_passive_voice(self, client):
        """Search for passive voice verbs."""
        resp = await client.post("/api/search/morph", json={
            "language": "greek",
            "part_of_speech": "verb",
            "voice": "passive",
        })
        assert resp.status_code == 200
        data = resp.json()
        for r in data.get("results", []):
            tvm = r["morphology"].split("-")[1]
            assert tvm[1] == "P"
