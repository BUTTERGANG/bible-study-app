"""Textual criticism apparatus — manuscript variants for disputed passages.

Endpoints:
  GET /api/textual               — list all variants (filterable by book/significance)
  GET /api/textual/{variant_id}  — get a specific variant

A curated seed set of the most significant NT textual variants is inserted
on first startup (idempotent via INSERT OR IGNORE).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_app_password
from ..database import get_db
from ..models import TextualVariant

router = APIRouter(
    prefix="/api/textual",
    tags=["textual"],
    dependencies=[Depends(require_app_password)],
)

# Curated seed data — 20 most-cited NT textual variants
_SEED_VARIANTS = [
    ("Mark", 16, 9, 16, 20, "The Long Ending of Mark",
     "Codex Sinaiticus, Vaticanus omit; supported by A, C, D, W, Majority Text",
     "critical",
     "Mark 16:9-20 is absent from the two oldest complete manuscripts (Sinaiticus and Vaticanus) and several early patristic writers. Most scholars regard it as a later scribal addition, though it is canonical for many traditions."),
    ("John", 7, 53, 8, 11, "The Pericope Adulterae",
     "Absent from P66, P75, Sinaiticus, Vaticanus, A, B, C, L, N, T, W; present in D, E, F, G, H, K, M, U",
     "critical",
     "The story of the woman caught in adultery (John 7:53–8:11) is absent from the earliest and most reliable manuscripts. Most scholars consider it an authentic early tradition not original to John's Gospel."),
    ("1 John", 5, 7, 5, 8, "Comma Johanneum",
     "Absent from all Greek MSS before 14th century except two late MSS; appears in Old Latin tradition",
     "critical",
     "The Trinitarian formula in 1 John 5:7–8 (KJV: 'the Father, the Word, and the Holy Ghost') is absent from virtually all Greek manuscripts and is considered a later Latin interpolation not part of the original text."),
    ("Mark", 1, 1, 1, 1, "Son of God in Mark 1:1",
     "Supported by Sinaiticus (corrected), A, B, D, L; omitted by Sinaiticus (original), Theta, 28",
     "high",
     "The phrase 'Son of God' in Mark 1:1 is absent from a small but significant set of manuscripts, including the original hand of Codex Sinaiticus. Some scholars see it as an early addition clarifying Mark's theological intent."),
    ("Luke", 22, 43, 22, 44, "The Bloody Sweat in Gethsemane",
     "Absent from P75, Sinaiticus (original), Vaticanus, A, B; present in D, Theta, and early patristic sources",
     "high",
     "The angelic strengthening and bloody sweat (Luke 22:43–44) are absent from important early manuscripts. Some scholars consider them a later addition; others view the omission as a theologically motivated scribal deletion."),
    ("Romans", 16, 24, 16, 24, "Grace Benediction in Romans 16:24",
     "Absent from P61, Sinaiticus, Vaticanus, C, D; present in K, L, P, most Majority Text MSS",
     "medium",
     "The closing grace benediction 'The grace of our Lord Jesus Christ be with you all. Amen' in Romans 16:24 is absent from several important witnesses. The doxology placement also varies significantly across manuscripts."),
    ("Luke", 23, 34, 23, 34, "Father Forgive Them in Luke 23:34",
     "Absent from P75, Sinaiticus (original), Vaticanus (original), D, W; present in A, C, L, Theta",
     "high",
     "Jesus's prayer for forgiveness of his executioners is absent from significant early manuscripts. Most scholars retain the verse as authentic tradition despite the textual uncertainty."),
    ("Matthew", 6, 13, 6, 13, "Lord's Prayer Doxology",
     "Absent from Sinaiticus, Vaticanus, D, Z; present in K, L, W, Theta, Majority Text, Didache",
     "high",
     "The doxology ending the Lord's Prayer ('For yours is the kingdom…') is absent from the oldest manuscripts and is generally considered a liturgical addition drawn from 1 Chronicles 29:11."),
    ("Acts", 8, 37, 8, 37, "Ethiopian Eunuch's Confession",
     "Absent from P45, P74, Sinaiticus, Vaticanus, A, B, C; present in E, many Majority Text MSS, Old Latin",
     "medium",
     "The Philip-eunuch dialogue and confession in Acts 8:37 is a Western text addition absent from the best early manuscripts. It was included in the Textus Receptus and appears in the KJV."),
    ("John", 1, 18, 1, 18, "Only Begotten God vs. Only Begotten Son",
     "monogenes theos: P66, P75, Sinaiticus, Vaticanus; monogenes huios: A, C3, Theta, Majority Text",
     "high",
     "John 1:18 reads either 'the only begotten God' (supported by the oldest manuscripts) or 'the only begotten Son' (found in the later Byzantine tradition). This variant has significant Christological implications."),
    ("1 Thessalonians", 2, 7, 2, 7, "Gentle vs. Infants in 1 Thessalonians 2:7",
     "epioi (gentle): Sinaiticus (corrected), A, C, D, I, K; nepioi (infants): Sinaiticus (original), B, G, P",
     "medium",
     "A single letter difference (epioi vs. nepioi) produces two very different meanings: 'we were gentle' or 'we were like infants.' The manuscript support is split between major traditions."),
    ("Mark", 1, 41, 1, 41, "Moved with Compassion vs. Moved with Anger",
     "splanchnistheis (compassion): Sinaiticus, A, B, C, L, W, Theta; orgistheis (anger): D, Old Latin",
     "medium",
     "The healer's emotional state when cleansing a leper is described as either 'compassion' (most manuscripts) or 'anger' (Codex Bezae and Old Latin). Many scholars consider 'anger' the harder reading and possibly original."),
    ("Luke", 24, 51, 24, 53, "Ascension in Luke 24",
     "Verses 51b and 52 absent from Sinaiticus, D, Old Latin (some); present in Vaticanus (corrected) and most MSS",
     "medium",
     "The explicit reference to the ascension and disciples' worship in Luke 24:51–52 is absent from several Western manuscripts. Some scholars see the omission as harmonizing with Acts 1, where the ascension occurs after 40 days."),
    ("John", 5, 3, 5, 4, "The Troubling of the Pool",
     "John 5:3b–4 absent from P66, P75, Sinaiticus, Vaticanus, A, B; present in C, E, F, Majority Text",
     "high",
     "The explanation that an angel stirred the water at the pool of Bethesda (John 5:3b–4) is absent from the best manuscripts. It appears to be an explanatory gloss that entered the text early in transmission."),
    ("Matthew", 27, 16, 27, 17, "Barabbas Called Jesus",
     "Iesous Barabban: Theta, f1, 700, Origen; simply Barabban: most Greek MSS",
     "medium",
     "A group of early manuscripts, including support from Origen, reads 'Jesus Barabbas' in Matthew 27:16–17, creating a deliberate irony: the crowd chose which 'Jesus' to release. Most later manuscripts dropped the first name."),
    ("2 Peter", 3, 10, 3, 10, "Earth Laid Bare vs. Destroyed",
     "heurethesetai (found/laid bare): Sinaiticus, B, K, P; ou heurethesetai (not found/destroyed): P72, Vaticanus (corrected), Sahidic",
     "high",
     "2 Peter 3:10 contains one of the most puzzling variants: whether the earth will be 'found' (laid bare / exposed) or 'not found' (destroyed). The reading 'found' is increasingly accepted as original."),
    ("Romans", 8, 28, 8, 28, "God Works All Things vs. All Things Work",
     "ho theos (God) subject: P46, Vaticanus; implicit subject (all things work): Sinaiticus, A, B, C, D",
     "medium",
     "Romans 8:28 may read either 'God works all things together' (with 'God' as explicit subject in P46 and Vaticanus) or 'all things work together' (with no explicit subject in most other manuscripts)."),
    ("Luke", 11, 2, 11, 4, "Lord's Prayer in Luke 11",
     "Luke's shorter version: P75, Sinaiticus, Vaticanus, L; harmonized to Matthew: A, C, D, Majority Text",
     "medium",
     "The Lord's Prayer in Luke 11:2–4 is shorter in the oldest manuscripts, lacking 'your will be done on earth as in heaven' and the doxology. The longer version in many manuscripts reflects harmonization with Matthew 6."),
    ("1 Corinthians", 14, 34, 14, 35, "Women Should Remain Silent",
     "Verses after v.33 in most MSS; after v.40 in D, E, F, G, 88, Old Latin",
     "high",
     "1 Corinthians 14:34–35 appears after verse 33 in most manuscripts but after verse 40 in the Western tradition (Codex Bezae and Old Latin). This displacement has led many scholars to propose the passage is a later interpolation."),
    ("Revelation", 22, 19, 22, 19, "Book of Life vs. Tree of Life",
     "tree of life: P1, Sinaiticus, Vaticanus, most Greek MSS; book of life: Latin Vulgate, Erasmus's back-translation",
     "critical",
     "Revelation 22:19 reads 'tree of life' in virtually all Greek manuscripts but 'book of life' in Erasmus's Textus Receptus (based on a Latin Vulgate back-translation). The KJV follows the erroneous 'book of life' reading."),
]


async def seed_textual_variants(db: AsyncSession) -> int:
    """Insert curated variants if the table is empty. Returns count inserted."""
    existing = await db.execute(select(TextualVariant).limit(1))
    if existing.scalar_one_or_none():
        return 0

    rows = [
        TextualVariant(
            book=book, chapter_start=cs, verse_start=vs,
            chapter_end=ce, verse_end=ve,
            short_title=title, manuscript_support=ms_support,
            significance=sig, explanation=explanation,
        )
        for book, cs, vs, ce, ve, title, ms_support, sig, explanation in _SEED_VARIANTS
    ]
    db.add_all(rows)
    await db.commit()
    return len(rows)


def _variant_dict(v: TextualVariant) -> dict:
    return {
        "id": v.id,
        "book": v.book,
        "chapter_start": v.chapter_start,
        "verse_start": v.verse_start,
        "chapter_end": v.chapter_end,
        "verse_end": v.verse_end,
        "short_title": v.short_title,
        "manuscript_support": v.manuscript_support,
        "significance": v.significance,
        "explanation": v.explanation,
        "external_ref": v.external_ref,
        "reference": f"{v.book} {v.chapter_start}:{v.verse_start}"
        if v.chapter_start == v.chapter_end and v.verse_start == v.verse_end
        else f"{v.book} {v.chapter_start}:{v.verse_start}–{v.chapter_end}:{v.verse_end}",
    }


@router.get("")
async def list_variants(
    book: str | None = None,
    significance: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(TextualVariant)
    if book:
        q = q.where(TextualVariant.book == book)
    if significance:
        q = q.where(TextualVariant.significance == significance)
    q = q.order_by(TextualVariant.book, TextualVariant.chapter_start, TextualVariant.verse_start)
    result = await db.execute(q)
    return {"variants": [_variant_dict(v) for v in result.scalars().all()]}


@router.get("/{variant_id}")
async def get_variant(variant_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TextualVariant).where(TextualVariant.id == variant_id))
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Variant not found")
    return _variant_dict(v)
