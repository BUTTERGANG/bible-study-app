#!/usr/bin/env python3
"""Seed factbook_entries from dictionary data already in the DB.

Pulls content from Easton's Bible Dictionary (ISBE as fallback) for
important biblical people, places, themes, and events, and inserts them
as pre-cached factbook entries so the panel works without an AI key.

Usage:
    cd /home/runner/workspace
    python3 ingest/seed_factbook.py
"""

import sqlite3
from datetime import UTC, datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "bible.db"

# ── Entity registry ──────────────────────────────────────────────────────────
# (entity_name, entity_type, dict_keys_to_try_in_order)
ENTITIES = [
    # People
    ("Adam",          "person",  ["ADAM"]),
    ("Eve",           "person",  ["EVE"]),
    ("Noah",          "person",  ["NOAH"]),
    ("Abraham",       "person",  ["ABRAHAM"]),
    ("Sarah",         "person",  ["SARAH"]),
    ("Isaac",         "person",  ["ISAAC"]),
    ("Jacob",         "person",  ["JACOB"]),
    ("Joseph",        "person",  ["JOSEPH"]),
    ("Moses",         "person",  ["MOSES"]),
    ("Aaron",         "person",  ["AARON"]),
    ("Joshua",        "person",  ["JOSHUA"]),
    ("Deborah",       "person",  ["DEBORAH"]),
    ("Gideon",        "person",  ["GIDEON"]),
    ("Samson",        "person",  ["SAMSON"]),
    ("Ruth",          "person",  ["RUTH"]),
    ("Samuel",        "person",  ["SAMUEL"]),
    ("Saul",          "person",  ["SAUL"]),
    ("David",         "person",  ["DAVID"]),
    ("Solomon",       "person",  ["SOLOMON"]),
    ("Elijah",        "person",  ["ELIJAH"]),
    ("Elisha",        "person",  ["ELISHA"]),
    ("Isaiah",        "person",  ["ISAIAH"]),
    ("Jeremiah",      "person",  ["JEREMIAH"]),
    ("Ezekiel",       "person",  ["EZEKIEL"]),
    ("Daniel",        "person",  ["DANIEL"]),
    ("Jonah",         "person",  ["JONAH"]),
    ("Ezra",          "person",  ["EZRA"]),
    ("Nehemiah",      "person",  ["NEHEMIAH"]),
    ("John the Baptist", "person", ["JOHN THE BAPTIST"]),
    ("Mary",          "person",  ["MARY"]),
    ("Joseph of Nazareth", "person", ["JOSEPH (HUSBAND OF MARY)", "JOSEPH"]),
    ("Peter",         "person",  ["PETER"]),
    ("Paul",          "person",  ["PAUL"]),
    ("John",          "person",  ["JOHN THE APOSTLE", "JOHN"]),
    ("James",         "person",  ["JAMES"]),
    ("Thomas",        "person",  ["THOMAS"]),
    ("Mary Magdalene","person",  ["MARY MAGDALENE"]),
    ("Nicodemus",     "person",  ["NICODEMUS"]),
    ("Pilate",        "person",  ["PILATE"]),
    ("Herod",         "person",  ["HEROD"]),
    ("Abraham",       "person",  ["ABRAHAM"]),
    ("Barnabas",      "person",  ["BARNABAS"]),
    ("Stephen",       "person",  ["STEPHEN"]),
    ("Timothy",       "person",  ["TIMOTHY"]),
    # Places
    ("Jerusalem",     "place",   ["JERUSALEM"]),
    ("Bethlehem",     "place",   ["BETHLEHEM"]),
    ("Nazareth",      "place",   ["NAZARETH"]),
    ("Egypt",         "place",   ["EGYPT"]),
    ("Canaan",        "place",   ["CANAAN"]),
    ("Sinai",         "place",   ["SINAI"]),
    ("Jordan River",  "place",   ["JORDAN RIVER", "JORDAN"]),
    ("Dead Sea",      "place",   ["DEAD SEA", "SALT SEA"]),
    ("Sea of Galilee","place",   ["SEA OF GALILEE", "GALILEE, SEA OF", "TIBERIAS"]),
    ("Mount Zion",    "place",   ["ZION"]),
    ("Garden of Gethsemane", "place", ["GETHSEMANE"]),
    ("Calvary",       "place",   ["CALVARY"]),
    ("Babylon",       "place",   ["BABYLON"]),
    ("Antioch",       "place",   ["ANTIOCH"]),
    ("Corinth",       "place",   ["CORINTH"]),
    ("Athens",        "place",   ["ATHENS"]),
    ("Rome",          "place",   ["ROME"]),
    ("Ephesus",       "place",   ["EPHESUS"]),
    ("Jericho",       "place",   ["JERICHO"]),
    ("Samaria",       "place",   ["SAMARIA"]),
    ("Capernaum",     "place",   ["CAPERNAUM"]),
    ("Galilee",       "place",   ["GALILEE"]),
    ("Judea",         "place",   ["JUDAH", "JUDEA"]),
    ("Mount Sinai",   "place",   ["SINAI", "HOREB"]),
    ("Mount of Olives","place",  ["MOUNT OF OLIVES", "OLIVET"]),
    ("Red Sea",       "place",   ["RED SEA"]),
    ("Wilderness of Sinai", "place", ["WILDERNESS"]),
    # Themes
    ("Salvation",     "theme",   ["SALVATION"]),
    ("Grace",         "theme",   ["GRACE"]),
    ("Faith",         "theme",   ["FAITH"]),
    ("Love",          "theme",   ["LOVE"]),
    ("Hope",          "theme",   ["HOPE"]),
    ("Prayer",        "theme",   ["PRAYER"]),
    ("Sin",           "theme",   ["SIN"]),
    ("Forgiveness",   "theme",   ["FORGIVENESS"]),
    ("Repentance",    "theme",   ["REPENTANCE"]),
    ("Holy Spirit",   "theme",   ["HOLY SPIRIT", "SPIRIT, HOLY"]),
    ("Baptism",       "theme",   ["BAPTISM"]),
    ("Communion",     "theme",   ["LORD'S SUPPER", "EUCHARIST"]),
    ("Covenant",      "theme",   ["COVENANT"]),
    ("Prophecy",      "theme",   ["PROPHECY"]),
    ("Resurrection",  "theme",   ["RESURRECTION"]),
    ("Kingdom of God","theme",   ["KINGDOM OF GOD", "KINGDOM OF HEAVEN"]),
    ("Atonement",     "theme",   ["ATONEMENT"]),
    ("Justification", "theme",   ["JUSTIFICATION"]),
    ("Sanctification","theme",   ["SANCTIFICATION"]),
    ("Trinity",       "theme",   ["TRINITY"]),
    ("Angels",        "theme",   ["ANGELS", "ANGEL"]),
    ("Satan",         "theme",   ["SATAN"]),
    ("Heaven",        "theme",   ["HEAVEN"]),
    ("Hell",          "theme",   ["HELL"]),
    ("Ten Commandments","theme", ["TEN COMMANDMENTS", "COMMANDMENTS"]),
    ("Tabernacle",    "theme",   ["TABERNACLE"]),
    ("Temple",        "theme",   ["TEMPLE"]),
    ("Sabbath",       "theme",   ["SABBATH"]),
    ("Passover",      "theme",   ["PASSOVER"]),
    ("Messiah",       "theme",   ["MESSIAH"]),
    # Events
    ("Creation",      "event",   ["CREATION"]),
    ("The Fall",      "event",   ["FALL OF MAN", "FALL"]),
    ("The Flood",     "event",   ["FLOOD", "NOAH'S FLOOD"]),
    ("The Exodus",    "event",   ["EXODUS"]),
    ("Giving of the Law", "event", ["LAW"]),
    ("The Crucifixion","event",  ["CRUCIFIXION", "CROSS"]),
    ("The Resurrection","event", ["RESURRECTION"]),
    ("Pentecost",     "event",   ["PENTECOST", "DAY OF PENTECOST"]),
    ("Transfiguration","event",  ["TRANSFIGURATION"]),
    ("Last Supper",   "event",   ["LAST SUPPER", "LORD'S SUPPER"]),
    ("Birth of Jesus","event",   ["INCARNATION", "VIRGIN BIRTH"]),
    ("Ascension",     "event",   ["ASCENSION"]),
    ("Second Coming", "event",   ["SECOND COMING", "PAROUSIA"]),
    ("Destruction of Jerusalem", "event", ["JERUSALEM"]),
    ("Tower of Babel","event",   ["BABEL"]),
    ("Sodom and Gomorrah", "event", ["SODOM"]),
    ("Battle of Jericho", "event", ["JERICHO"]),
    ("Anointing of David", "event", ["DAVID"]),
    ("The Sermon on the Mount", "event", ["SERMON ON THE MOUNT"]),
]


def find_content(conn: sqlite3.Connection, keys: list[str]) -> str | None:
    """Find best content for an entity from dictionary entries.
    Tries Easton first, then ISBE, then Smith."""
    preferred = ["Easton", "ISBE", "Smith"]
    for source in preferred:
        for key in keys:
            row = conn.execute(
                "SELECT text FROM dictionary_entries WHERE source=? AND term=?",
                (source, key),
            ).fetchone()
            if row and row[0].strip():
                return row[0].strip()
    # Fuzzy fallback: LIKE match
    for source in preferred:
        for key in keys:
            row = conn.execute(
                "SELECT term, text FROM dictionary_entries WHERE source=? AND term LIKE ? LIMIT 1",
                (source, f"%{key}%"),
            ).fetchone()
            if row and row[1].strip():
                return row[1].strip()
    return None


def main():
    conn = sqlite3.connect(DB_PATH)

    existing = conn.execute("SELECT COUNT(*) FROM factbook_entries").fetchone()[0]
    if existing:
        print(f"Factbook already has {existing} entries — clearing for fresh seed...")
        conn.execute("DELETE FROM factbook_entries")
        conn.commit()

    now = datetime.now(UTC).isoformat()
    inserted = 0
    skipped = 0
    seen_names = set()

    rows = []
    for entity_name, entity_type, dict_keys in ENTITIES:
        if entity_name in seen_names:
            continue
        seen_names.add(entity_name)

        content = find_content(conn, dict_keys)
        if not content:
            print(f"  SKIP (no content): {entity_name}")
            skipped += 1
            continue

        rows.append((entity_name, entity_type, content, now, now))
        inserted += 1

    conn.executemany(
        "INSERT INTO factbook_entries (entity_name, entity_type, content, generated_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()

    print(f"\nInserted {inserted} factbook entries ({skipped} skipped — no dictionary match)")

    # Per-type summary
    for row in conn.execute(
        "SELECT entity_type, COUNT(*) FROM factbook_entries GROUP BY entity_type ORDER BY entity_type"
    ).fetchall():
        print(f"  {row[0]}: {row[1]}")

    # Spot checks
    print("\nSpot checks:")
    for name in ["Moses", "Jerusalem", "Salvation", "The Exodus"]:
        row = conn.execute(
            "SELECT entity_name, entity_type, content FROM factbook_entries WHERE entity_name=?",
            (name,),
        ).fetchone()
        if row:
            print(f"  {row[0]} ({row[1]}): {row[2][:80]}...")
        else:
            print(f"  {name}: NOT FOUND")

    conn.close()


if __name__ == "__main__":
    main()
