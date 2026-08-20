"""NT Use of OT — curated connections between Old Testament sources and New Testament citations.

GET /api/nt-ot              — query connections (filter by nt_ or ot_ params)
GET /api/nt-ot/stats        — coverage statistics
"""
import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import NtOtConnection

logger = logging.getLogger("bible-study")
router = APIRouter(prefix="/api/nt-ot", tags=["nt-ot"])

# fmt: off
# Curated dataset: (nt_book, nt_ch, nt_v, ot_book, ot_ch, ot_v, type, notes)
# connection_type: direct_quotation | verbal_parallel | allusion | thematic_echo | typology
_SEED: list[tuple] = [
    # ── Matthew ────────────────────────────────────────────────────────────
    ("Matthew", 1, 23, "Isaiah",      7, 14, "direct_quotation",  "Virgin birth prophecy: 'Behold, a virgin shall conceive' (Isa 7:14)"),
    ("Matthew", 2,  6, "Micah",       5,  2, "direct_quotation",  "Ruler to come out of Bethlehem Ephrathah (Mic 5:2)"),
    ("Matthew", 2, 15, "Hosea",      11,  1, "direct_quotation",  "'Out of Egypt I called my son' — corporate→individual typology"),
    ("Matthew", 2, 18, "Jeremiah",   31, 15, "direct_quotation",  "Rachel weeping for her children: voice heard in Ramah (Jer 31:15)"),
    ("Matthew", 3,  3, "Isaiah",     40,  3, "direct_quotation",  "John the Baptist as the voice crying in the wilderness (Isa 40:3)"),
    ("Matthew", 4,  4, "Deuteronomy", 8,  3, "direct_quotation",  "Man shall not live by bread alone but by every word of God (Deut 8:3)"),
    ("Matthew", 4,  7, "Deuteronomy", 6, 16, "direct_quotation",  "'Do not put the Lord your God to the test' (Deut 6:16)"),
    ("Matthew", 4, 10, "Deuteronomy", 6, 13, "direct_quotation",  "'Worship the Lord your God and serve him only' (Deut 6:13)"),
    ("Matthew", 8, 17, "Isaiah",     53,  4, "direct_quotation",  "'He took up our infirmities and bore our diseases' (Isa 53:4)"),
    ("Matthew",12, 18, "Isaiah",     42,  1, "direct_quotation",  "Servant song: 'My servant whom I have chosen' (Isa 42:1-4)"),
    ("Matthew",21,  5, "Zechariah",   9,  9, "direct_quotation",  "Triumphal entry: 'Your king comes riding on a donkey' (Zech 9:9)"),
    ("Matthew",21,  9, "Psalms",    118, 25, "verbal_parallel",   "Hosanna: 'Blessed is he who comes in the name of the LORD' (Ps 118:26)"),
    ("Matthew",21, 42, "Psalms",    118, 22, "direct_quotation",  "'The stone the builders rejected has become the cornerstone' (Ps 118:22)"),
    ("Matthew",26, 15, "Zechariah", 11, 12, "direct_quotation",  "Thirty pieces of silver — the price set on the shepherd (Zech 11:12)"),
    ("Matthew",26, 31, "Zechariah", 13,  7, "direct_quotation",  "'Strike the shepherd and the sheep will be scattered' (Zech 13:7)"),
    ("Matthew",27, 46, "Psalms",    22,  1, "direct_quotation",  "'My God, my God, why have you forsaken me?' — Ps 22 Passion parallel"),
    # ── Mark ───────────────────────────────────────────────────────────────
    ("Mark",    1,  2, "Malachi",    3,  1, "direct_quotation",  "'I will send my messenger ahead of you' (Mal 3:1)"),
    ("Mark",    1,  3, "Isaiah",    40,  3, "direct_quotation",  "'Prepare the way of the Lord' (Isa 40:3)"),
    ("Mark",   12, 10, "Psalms",   118, 22, "direct_quotation",  "Cornerstone: the stone the builders rejected (Ps 118:22)"),
    ("Mark",   14, 27, "Zechariah", 13,  7, "direct_quotation",  "Strike the shepherd, sheep scattered (Zech 13:7)"),
    ("Mark",   15, 34, "Psalms",    22,  1, "direct_quotation",  "'My God, my God, why have you forsaken me?' (Ps 22:1)"),
    # ── Luke ───────────────────────────────────────────────────────────────
    ("Luke",    1, 46, "1 Samuel",   2,  1, "thematic_echo",     "Magnificat echoes Hannah's Song of praise (1 Sam 2:1-10)"),
    ("Luke",    4, 18, "Isaiah",    61,  1, "direct_quotation",  "'The Spirit of the Lord is on me … to proclaim good news' (Isa 61:1-2)"),
    ("Luke",   20, 17, "Psalms",   118, 22, "direct_quotation",  "'The stone the builders rejected' — cornerstone (Ps 118:22)"),
    ("Luke",   22, 37, "Isaiah",    53, 12, "direct_quotation",  "'He was numbered with the transgressors' (Isa 53:12)"),
    # ── John ───────────────────────────────────────────────────────────────
    ("John",    1, 23, "Isaiah",    40,  3, "direct_quotation",  "John the Baptist: 'I am the voice of one calling in the desert' (Isa 40:3)"),
    ("John",    1, 29, "Isaiah",    53,  7, "typology",          "'Lamb of God' — Passover lamb + Suffering Servant (Isa 53; Exod 12)"),
    ("John",    2, 17, "Psalms",    69,  9, "direct_quotation",  "'Zeal for your house will consume me' (Ps 69:9)"),
    ("John",    6, 31, "Psalms",    78, 24, "verbal_parallel",   "'He gave them bread from heaven to eat' (Ps 78:24)"),
    ("John",   12, 15, "Zechariah",  9,  9, "direct_quotation",  "'Do not be afraid, Daughter Zion; your king is coming' (Zech 9:9)"),
    ("John",   12, 38, "Isaiah",    53,  1, "direct_quotation",  "'Lord, who has believed our message?' (Isa 53:1)"),
    ("John",   12, 40, "Isaiah",     6, 10, "direct_quotation",  "'He has blinded their eyes and hardened their hearts' (Isa 6:10)"),
    ("John",   13, 18, "Psalms",    41,  9, "direct_quotation",  "'He who shared my bread has turned against me' (Ps 41:9)"),
    ("John",   15, 25, "Psalms",    35, 19, "verbal_parallel",   "'They hated me without reason' (Ps 35:19; 69:4)"),
    ("John",   19, 24, "Psalms",    22, 18, "direct_quotation",  "Soldiers cast lots for garments (Ps 22:18)"),
    ("John",   19, 28, "Psalms",    22, 15, "allusion",          "'I am thirsty' — Ps 22:15 and Ps 69:21 passion parallels"),
    ("John",   19, 36, "Exodus",    12, 46, "typology",          "No bone of Jesus broken — fulfills Passover lamb regulation (Exod 12:46)"),
    ("John",   19, 37, "Zechariah", 12, 10, "direct_quotation",  "'They will look on the one they have pierced' (Zech 12:10)"),
    # ── Acts ───────────────────────────────────────────────────────────────
    ("Acts",    2, 17, "Joel",       2, 28, "direct_quotation",  "'I will pour out my Spirit on all people' — Pentecost (Joel 2:28-32)"),
    ("Acts",    2, 25, "Psalms",    16,  8, "direct_quotation",  "David's prophecy of resurrection: 'you will not abandon me to the realm of the dead' (Ps 16:8-11)"),
    ("Acts",    2, 34, "Psalms",   110,  1, "direct_quotation",  "'The LORD said to my Lord: Sit at my right hand' (Ps 110:1)"),
    ("Acts",    3, 22, "Deuteronomy",18,15, "direct_quotation",  "'The LORD your God will raise up for you a prophet like me' (Deut 18:15)"),
    ("Acts",    4, 11, "Psalms",   118, 22, "direct_quotation",  "Cornerstone: rejected stone (Ps 118:22) applied to Jesus' resurrection"),
    ("Acts",    8, 32, "Isaiah",    53,  7, "direct_quotation",  "'He was led like a sheep to the slaughter' (Isa 53:7-8) — Ethiopian eunuch passage"),
    ("Acts",   13, 33, "Psalms",     2,  7, "direct_quotation",  "'You are my Son; today I have become your Father' (Ps 2:7)"),
    ("Acts",   13, 34, "Isaiah",    55,  3, "direct_quotation",  "'Holy and sure blessings promised to David' (Isa 55:3)"),
    # ── Romans ─────────────────────────────────────────────────────────────
    ("Romans",  1, 17, "Habakkuk",   2,  4, "direct_quotation",  "'The righteous will live by faith' (Hab 2:4) — key Reformation text"),
    ("Romans",  3, 10, "Psalms",    14,  1, "direct_quotation",  "'There is no one righteous, not even one' (Ps 14:1-3; 53:1-3)"),
    ("Romans",  3, 13, "Psalms",     5,  9, "direct_quotation",  "'Their throats are open graves; their tongues deceive' (Ps 5:9; 140:3)"),
    ("Romans",  4,  3, "Genesis",   15,  6, "direct_quotation",  "'Abraham believed God, and it was credited to him as righteousness' (Gen 15:6)"),
    ("Romans",  4,  7, "Psalms",    32,  1, "direct_quotation",  "'Blessed are those whose transgressions are forgiven' (Ps 32:1-2)"),
    ("Romans",  8, 36, "Psalms",    44, 22, "direct_quotation",  "'For your sake we face death all day long' (Ps 44:22)"),
    ("Romans",  9,  7, "Genesis",   21, 12, "direct_quotation",  "'It is through Isaac that your offspring will be reckoned' (Gen 21:12)"),
    ("Romans",  9, 13, "Malachi",    1,  2, "direct_quotation",  "'Jacob I loved, but Esau I hated' (Mal 1:2-3)"),
    ("Romans",  9, 15, "Exodus",    33, 19, "direct_quotation",  "'I will have mercy on whom I have mercy' (Exod 33:19)"),
    ("Romans",  9, 25, "Hosea",      2, 23, "direct_quotation",  "'I will call them my people who are not my people' (Hos 2:23; 1:10)"),
    ("Romans", 10,  5, "Leviticus", 18,  5, "direct_quotation",  "'The person who does these things will live by them' (Lev 18:5)"),
    ("Romans", 10, 13, "Joel",       2, 32, "direct_quotation",  "'Everyone who calls on the name of the LORD will be saved' (Joel 2:32)"),
    ("Romans", 10, 15, "Isaiah",    52,  7, "direct_quotation",  "'How beautiful the feet of those who bring good news' (Isa 52:7)"),
    ("Romans", 10, 16, "Isaiah",    53,  1, "direct_quotation",  "'Lord, who has believed our message?' (Isa 53:1)"),
    ("Romans", 11,  3, "1 Kings",   19, 10, "direct_quotation",  "Elijah's complaint: 'They have killed your prophets' (1 Kgs 19:10)"),
    ("Romans", 11,  4, "1 Kings",   19, 18, "direct_quotation",  "'I have reserved 7,000 who have not bowed to Baal' — remnant (1 Kgs 19:18)"),
    ("Romans", 11, 26, "Isaiah",    59, 20, "direct_quotation",  "'The deliverer will come from Zion' (Isa 59:20-21)"),
    ("Romans", 12, 19, "Deuteronomy",32,35, "direct_quotation",  "'It is mine to avenge; I will repay' (Deut 32:35)"),
    ("Romans", 12, 20, "Proverbs",  25, 21, "direct_quotation",  "'Heap burning coals on his head' by feeding enemies (Prov 25:21-22)"),
    ("Romans", 14, 11, "Isaiah",    45, 23, "direct_quotation",  "'Every knee will bow before me' (Isa 45:23)"),
    # ── 1-2 Corinthians ────────────────────────────────────────────────────
    ("1 Corinthians",  1, 19, "Isaiah",    29, 14, "direct_quotation",  "'I will destroy the wisdom of the wise' (Isa 29:14)"),
    ("1 Corinthians",  1, 31, "Jeremiah",   9, 24, "direct_quotation",  "'Let the one who boasts boast in the Lord' (Jer 9:24)"),
    ("1 Corinthians",  5,  7, "Exodus",    12, 21, "typology",          "Christ as our Passover lamb — unleavened bread typology (Exod 12)"),
    ("1 Corinthians",  6, 16, "Genesis",    2, 24, "direct_quotation",  "'The two will become one flesh' — marriage created order (Gen 2:24)"),
    ("1 Corinthians", 10,  1, "Exodus",    13, 21, "typology",          "Cloud and sea = baptism; rock = Christ — Exodus wilderness typology"),
    ("1 Corinthians", 15, 27, "Psalms",     8,  6, "direct_quotation",  "'God put everything under his feet' (Ps 8:6) — Christ as true humanity"),
    ("1 Corinthians", 15, 54, "Isaiah",    25,  8, "direct_quotation",  "'Death has been swallowed up in victory' (Isa 25:8)"),
    ("1 Corinthians", 15, 55, "Hosea",     13, 14, "direct_quotation",  "'Where, O death, is your victory?' (Hos 13:14)"),
    ("2 Corinthians",  6,  2, "Isaiah",    49,  8, "direct_quotation",  "'In the time of my favor I heard you' — now is the day of salvation (Isa 49:8)"),
    ("2 Corinthians",  6, 16, "Ezekiel",   37, 27, "direct_quotation",  "'I will be their God and they will be my people' (Ezek 37:27; Lev 26:12)"),
    # ── Galatians ──────────────────────────────────────────────────────────
    ("Galatians",  3,  6, "Genesis",   15,  6, "direct_quotation",  "'Abraham believed God, and it was credited as righteousness' (Gen 15:6)"),
    ("Galatians",  3,  8, "Genesis",   12,  3, "direct_quotation",  "'All nations will be blessed through you' — Abrahamic covenant (Gen 12:3)"),
    ("Galatians",  3, 11, "Habakkuk",   2,  4, "direct_quotation",  "'The righteous will live by faith' (Hab 2:4)"),
    ("Galatians",  3, 13, "Deuteronomy",21,23, "direct_quotation",  "'Cursed is everyone who is hung on a pole' (Deut 21:23) — cross typology"),
    ("Galatians",  3, 16, "Genesis",   13, 15, "verbal_parallel",   "'To your seed' (singular) applied to Christ — Abrahamic promise (Gen 13:15; 17:7)"),
    ("Galatians",  4, 27, "Isaiah",    54,  1, "direct_quotation",  "'Be glad, barren woman who never bore a child' (Isa 54:1)"),
    # ── Ephesians ──────────────────────────────────────────────────────────
    ("Ephesians",  4,  8, "Psalms",    68, 18, "direct_quotation",  "'When he ascended on high, he took many captives' (Ps 68:18)"),
    ("Ephesians",  5, 31, "Genesis",    2, 24, "direct_quotation",  "'The two will become one flesh' applied to Christ and the Church (Gen 2:24)"),
    ("Ephesians",  6,  2, "Exodus",    20, 12, "direct_quotation",  "'Honor your father and mother' — fifth commandment (Exod 20:12; Deut 5:16)"),
    # ── Philippians ────────────────────────────────────────────────────────
    ("Philippians", 2, 10, "Isaiah",   45, 23, "allusion",          "'Every knee will bow … every tongue confess' (Isa 45:23) — exalted Christ"),
    # ── Hebrews ────────────────────────────────────────────────────────────
    ("Hebrews",  1,  5, "Psalms",     2,  7, "direct_quotation",  "'You are my Son; today I have become your Father' (Ps 2:7)"),
    ("Hebrews",  1,  5, "2 Samuel",   7, 14, "verbal_parallel",   "'I will be his Father, and he will be my Son' — Davidic covenant (2 Sam 7:14)"),
    ("Hebrews",  1,  8, "Psalms",    45,  6, "direct_quotation",  "'Your throne, O God, will last forever and ever' (Ps 45:6-7)"),
    ("Hebrews",  1, 13, "Psalms",   110,  1, "direct_quotation",  "'Sit at my right hand until I make your enemies a footstool' (Ps 110:1)"),
    ("Hebrews",  2,  6, "Psalms",     8,  4, "direct_quotation",  "'What is mankind that you are mindful of them?' (Ps 8:4-6) — Son of Man"),
    ("Hebrews",  2, 12, "Psalms",    22, 22, "direct_quotation",  "'I will declare your name to my brothers and sisters' (Ps 22:22)"),
    ("Hebrews",  3,  7, "Psalms",    95,  7, "direct_quotation",  "'Today, if you hear his voice, do not harden your hearts' (Ps 95:7-11)"),
    ("Hebrews",  5,  5, "Psalms",     2,  7, "direct_quotation",  "Christ did not glorify himself — same Ps 2:7 sonship declaration"),
    ("Hebrews",  5,  6, "Psalms",   110,  4, "direct_quotation",  "'You are a priest forever, in the order of Melchizedek' (Ps 110:4)"),
    ("Hebrews",  7,  1, "Genesis",   14, 18, "typology",          "Melchizedek: eternal priest-king without genealogy — type of Christ (Gen 14:18-20)"),
    ("Hebrews",  8,  8, "Jeremiah",  31, 31, "direct_quotation",  "'I will make a new covenant with the people of Israel' (Jer 31:31-34)"),
    ("Hebrews",  9, 20, "Exodus",    24,  8, "verbal_parallel",   "'This is the blood of the covenant' — Sinai covenant ratification (Exod 24:8)"),
    ("Hebrews", 10,  5, "Psalms",    40,  6, "direct_quotation",  "'Sacrifice and offering you did not desire … a body you prepared' (Ps 40:6-8)"),
    ("Hebrews", 10, 16, "Jeremiah",  31, 33, "direct_quotation",  "New covenant: law written on hearts, sins remembered no more (Jer 31:33-34)"),
    ("Hebrews", 10, 37, "Habakkuk",   2,  3, "direct_quotation",  "'He who is coming will come and will not delay' (Hab 2:3-4)"),
    ("Hebrews", 12,  5, "Proverbs",   3, 11, "direct_quotation",  "'The Lord disciplines the one he loves' (Prov 3:11-12)"),
    ("Hebrews", 12, 26, "Haggai",     2,  6, "direct_quotation",  "'Once more I will shake the heavens and the earth' (Hag 2:6)"),
    # ── James ──────────────────────────────────────────────────────────────
    ("James",  2,  8, "Leviticus",  19, 18, "direct_quotation",  "'Love your neighbor as yourself' — royal law (Lev 19:18)"),
    ("James",  2, 23, "Genesis",    15,  6, "direct_quotation",  "'Abraham believed God, and it was credited as righteousness' (Gen 15:6)"),
    ("James",  4,  6, "Proverbs",    3, 34, "direct_quotation",  "'God opposes the proud but shows favor to the humble' (Prov 3:34)"),
    # ── 1 Peter ────────────────────────────────────────────────────────────
    ("1 Peter",  1, 16, "Leviticus", 11, 44, "direct_quotation",  "'Be holy, because I am holy' (Lev 11:44-45) — holiness standard"),
    ("1 Peter",  1, 24, "Isaiah",    40,  6, "direct_quotation",  "'All people are like grass … the word of God endures forever' (Isa 40:6-8)"),
    ("1 Peter",  2,  6, "Isaiah",    28, 16, "direct_quotation",  "'I lay a stone in Zion, a chosen and precious cornerstone' (Isa 28:16)"),
    ("1 Peter",  2,  7, "Psalms",   118, 22, "direct_quotation",  "'The stone the builders rejected has become the cornerstone' (Ps 118:22)"),
    ("1 Peter",  2,  8, "Isaiah",     8, 14, "direct_quotation",  "Stone of stumbling and rock of offense (Isa 8:14)"),
    ("1 Peter",  2, 22, "Isaiah",    53,  9, "direct_quotation",  "'He committed no sin, and no deceit was found in his mouth' (Isa 53:9)"),
    ("1 Peter",  2, 24, "Isaiah",    53,  5, "direct_quotation",  "'By his wounds you have been healed' (Isa 53:4-6)"),
    ("1 Peter",  5,  5, "Proverbs",   3, 34, "direct_quotation",  "'God opposes the proud but shows favor to the humble' (Prov 3:34)"),
    # ── Revelation ─────────────────────────────────────────────────────────
    ("Revelation",  1,  7, "Zechariah", 12, 10, "direct_quotation",  "'They will look on the one they have pierced' (Zech 12:10; Dan 7:13)"),
    ("Revelation",  3,  7, "Isaiah",    22, 22, "allusion",           "'Key of David' — authority over the house of David (Isa 22:22)"),
    ("Revelation",  5,  5, "Genesis",   49,  9, "typology",           "'Lion of the tribe of Judah' — fulfills Jacob's blessing (Gen 49:9-10)"),
    ("Revelation", 12,  5, "Psalms",     2,  9, "allusion",           "The child who will rule with an iron scepter (Ps 2:9)"),
    ("Revelation", 19, 15, "Isaiah",    11,  4, "allusion",           "Sword from mouth + rod of iron — Messianic warrior judge (Isa 11:4; Ps 2:9)"),
    ("Revelation", 21,  3, "Ezekiel",   37, 27, "thematic_echo",      "God dwelling with his people — renewed covenant fulfillment (Ezek 37:27; Lev 26:12)"),
    ("Revelation", 21,  7, "2 Samuel",   7, 14, "thematic_echo",      "'I will be his God and he will be my son' — Davidic covenant consummated (2 Sam 7:14)"),
    ("Revelation", 22, 16, "Numbers",   24, 17, "typology",           "'Bright morning star' — Balaam's star prophecy fulfilled (Num 24:17; Isa 11:1)"),
]
# fmt: on

_NT_BOOKS = {
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
    "Jude", "Revelation",
}


async def seed_nt_ot_connections(db: AsyncSession) -> int:
    """Insert curated connections if the table is empty. Returns rows inserted."""
    result = await db.execute(select(NtOtConnection).limit(1))
    if result.scalar_one_or_none() is not None:
        return 0

    for (nt_book, nt_ch, nt_v, ot_book, ot_ch, ot_v, conn_type, notes) in _SEED:
        db.add(NtOtConnection(
            nt_book=nt_book, nt_chapter=nt_ch, nt_verse=nt_v,
            ot_book=ot_book, ot_chapter=ot_ch, ot_verse=ot_v,
            connection_type=conn_type, confidence="curated", notes=notes,
        ))

    await db.commit()
    logger.info("NT-OT: seeded %d curated connections", len(_SEED))
    return len(_SEED)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def get_connections(
    nt_book:    str | None = Query(default=None),
    nt_chapter: int | None = Query(default=None),
    nt_verse:   int | None = Query(default=None),
    ot_book:    str | None = Query(default=None),
    ot_chapter: int | None = Query(default=None),
    ot_verse:   int | None = Query(default=None),
    connection_type: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Return NT-OT connections, optionally filtered by NT or OT reference.

    Pass nt_* params to find OT sources for an NT passage.
    Pass ot_* params to find NT citations of an OT passage.
    """
    stmt = select(NtOtConnection)

    if nt_book:
        stmt = stmt.where(NtOtConnection.nt_book == nt_book)
    if nt_chapter is not None:
        stmt = stmt.where(NtOtConnection.nt_chapter == nt_chapter)
    if nt_verse is not None:
        stmt = stmt.where(NtOtConnection.nt_verse == nt_verse)
    if ot_book:
        stmt = stmt.where(NtOtConnection.ot_book == ot_book)
    if ot_chapter is not None:
        stmt = stmt.where(NtOtConnection.ot_chapter == ot_chapter)
    if ot_verse is not None:
        stmt = stmt.where(NtOtConnection.ot_verse == ot_verse)
    if connection_type:
        stmt = stmt.where(NtOtConnection.connection_type == connection_type)

    stmt = stmt.limit(limit)
    rows = (await db.execute(stmt)).scalars().all()

    if not rows:
        return {"connections": [], "count": 0}

    # Batch-fetch verse texts for all unique references
    nt_refs = {(r.nt_book, r.nt_chapter, r.nt_verse) for r in rows}
    ot_refs = {(r.ot_book, r.ot_chapter, r.ot_verse) for r in rows}
    all_refs = nt_refs | ot_refs

    verse_map: dict[tuple, str] = {}
    if all_refs:
        placeholders = ",".join(
            f"(:b{i},:c{i},:v{i})" for i in range(len(all_refs))
        )
        params: dict = {}
        for i, (bk, ch, vs) in enumerate(all_refs):
            params[f"b{i}"] = bk
            params[f"c{i}"] = ch
            params[f"v{i}"] = vs

        verse_rows = await db.execute(
            text(
                f"""SELECT book, chapter, verse, text
                   FROM bible_verses
                   WHERE translation = 'KJV'
                     AND (book, chapter, verse) IN ({placeholders})"""
            ),
            params,
        )
        for vr in verse_rows:
            verse_map[(vr.book, vr.chapter, vr.verse)] = vr.text

    _type_order = {
        "direct_quotation": 0,
        "verbal_parallel": 1,
        "allusion": 2,
        "thematic_echo": 3,
        "typology": 4,
    }

    connections = []
    for r in sorted(rows, key=lambda x: _type_order.get(x.connection_type, 9)):
        connections.append({
            "id": r.id,
            "nt": {
                "book": r.nt_book,
                "chapter": r.nt_chapter,
                "verse": r.nt_verse,
                "reference": f"{r.nt_book} {r.nt_chapter}:{r.nt_verse}",
                "text": verse_map.get((r.nt_book, r.nt_chapter, r.nt_verse), ""),
            },
            "ot": {
                "book": r.ot_book,
                "chapter": r.ot_chapter,
                "verse": r.ot_verse,
                "reference": f"{r.ot_book} {r.ot_chapter}:{r.ot_verse}",
                "text": verse_map.get((r.ot_book, r.ot_chapter, r.ot_verse), ""),
            },
            "connection_type": r.connection_type,
            "confidence": r.confidence,
            "notes": r.notes,
        })

    return {"connections": connections, "count": len(connections)}


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Coverage statistics for the NT-OT dataset."""
    result = await db.execute(
        text("""
            SELECT connection_type, COUNT(*) AS cnt
            FROM nt_ot_connections
            GROUP BY connection_type
            ORDER BY cnt DESC
        """)
    )
    by_type = {row.connection_type: row.cnt for row in result}

    total = sum(by_type.values())

    nt_books_result = await db.execute(
        text("SELECT DISTINCT nt_book FROM nt_ot_connections ORDER BY nt_book")
    )
    nt_books = [row.nt_book for row in nt_books_result]

    ot_books_result = await db.execute(
        text("SELECT DISTINCT ot_book FROM nt_ot_connections ORDER BY ot_book")
    )
    ot_books = [row.ot_book for row in ot_books_result]

    return {
        "total": total,
        "by_type": by_type,
        "nt_books_covered": nt_books,
        "ot_books_cited": ot_books,
    }
