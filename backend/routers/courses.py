"""Original Language Courses — structured Greek and Hebrew curriculum.

Endpoints:
  GET  /api/courses                        — list available courses
  GET  /api/courses/{language}             — get course index for a language
  GET  /api/courses/{language}/units/{unit_number}          — get unit detail
  GET  /api/courses/{language}/units/{unit_number}/lessons/{lesson_number} — get lesson
  GET  /api/courses/{language}/progress    — get user's progress
  POST /api/courses/{language}/progress    — update user's progress
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import (
    CourseLesson,
    CourseUnit,
    LanguageCourse,
    LessonExercise,
    UserCourseProgress,
)

router = APIRouter(prefix="/api/courses", tags=["courses"])


# ── Seed data ────────────────────────────────────────────────────────────────

_GREEK_ALPHABET = [
    ("Α α", "Alpha", "a", "short 'a' as in father", "ἀγάπη (love)"),
    ("Β β", "Beta", "b", "'b' as in Bible", "Βίβλος (book)"),
    ("Γ γ", "Gamma", "g", "'g' as in go (before α,ε,ο,υ); 'ng' before γ,κ,ξ,χ", "γῆ (earth)"),
    ("Δ δ", "Delta", "d", "'d' as in David", "δόξα (glory)"),
    ("Ε ε", "Epsilon", "e", "short 'e' as in met", "ἐκκλησία (church)"),
    ("Ζ ζ", "Zeta", "z", "'z' as in zone (or 'dz' in some dialects)", "ζωή (life)"),
    ("Η η", "Eta", "ē", "long 'e' as in they", "ἡμέρα (day)"),
    ("Θ θ", "Theta", "th", "'th' as in think", "θεός (God)"),
    ("Ι ι", "Iota", "i", "short 'i' as in hit (long: 'ee' as in see)", "Ἰησοῦς (Jesus)"),
    ("Κ κ", "Kappa", "k", "'k' as in king", "κύριος (Lord)"),
    ("Λ λ", "Lambda", "l", "'l' as in love", "λόγος (word)"),
    ("Μ μ", "Mu", "m", "'m' as in mercy", "μαθητής (disciple)"),
    ("Ν ν", "Nu", "n", "'n' as in new", "νόμος (law)"),
    ("Ξ ξ", "Xi", "x", "'x' as in axiom", "ξύλον (wood/cross)"),
    ("Ο ο", "Omicron", "o", "short 'o' as in off", "ὁδός (way)"),
    ("Π π", "Pi", "p", "'p' as in peace", "πίστις (faith)"),
    ("Ρ ρ", "Rho", "r", "rolled 'r'", "ῥῆμα (word/saying)"),
    ("Σ σ/ς", "Sigma", "s", "'s' as in save (ς used at end of word)", "σωτηρία (salvation)"),
    ("Τ τ", "Tau", "t", "'t' as in truth", "τέκνον (child)"),
    ("Υ υ", "Upsilon", "u/y", "like German 'ü' or French 'u'", "υἱός (son)"),
    ("Φ φ", "Phi", "ph", "'ph' as in phone (or 'f')", "φῶς (light)"),
    ("Χ χ", "Chi", "ch", "guttural 'ch' as in Bach", "χάρις (grace)"),
    ("Ψ ψ", "Psi", "ps", "'ps' as in lapse", "ψυχή (soul)"),
    ("Ω ω", "Omega", "ō", "long 'o' as in tone", "ὥρα (hour)"),
]

_HEBREW_ALPHABET = [
    ("א", "Aleph", "ʾ", "silent (glottal stop)", "אָב (father)"),
    ("ב", "Bet/Vet", "b/v", "'b' with dagesh; 'v' without", "בַּיִת (house)"),
    ("ג", "Gimel", "g", "'g' as in go", "גָּדוֹל (great)"),
    ("ד", "Dalet", "d", "'d' as in door", "דָּבָר (word)"),
    ("ה", "He", "h", "aspirated 'h'; silent at end of word", "הִיא (she)"),
    ("ו", "Vav", "v/w", "'v' as in vine; also used as vowel letter", "וְ (and)"),
    ("ז", "Zayin", "z", "'z' as in Zion", "זָכַר (remember)"),
    ("ח", "Chet", "ḥ", "guttural 'ch' as in Bach", "חֶסֶד (lovingkindness)"),
    ("ט", "Tet", "ṭ", "emphatic 't'", "טוֹב (good)"),
    ("י", "Yod", "y", "'y' as in yes; also vowel letter", "יָד (hand)"),
    ("כ ך", "Kaf/Chaf", "k/kh", "'k' with dagesh; guttural 'ch' without; ך final form", "כָּבוֹד (glory)"),
    ("ל", "Lamed", "l", "'l' as in love", "לֵב (heart)"),
    ("מ ם", "Mem", "m", "'m' as in mercy; ם final form", "מֶלֶךְ (king)"),
    ("נ ן", "Nun", "n", "'n' as in name; ן final form", "נֶפֶשׁ (soul)"),
    ("ס", "Samech", "s", "'s' as in spirit", "סֵפֶר (book)"),
    ("ע", "Ayin", "ʿ", "voiced guttural (deeper than Aleph)", "עִיר (city)"),
    ("פ ף", "Pe/Fe", "p/f", "'p' with dagesh; 'f' without; ף final form", "פֶּה (mouth)"),
    ("צ ץ", "Tsade", "ts", "'ts' as in cats; ץ final form", "צַדִּיק (righteous)"),
    ("ק", "Qof", "q", "uvular 'k'", "קָדוֹשׁ (holy)"),
    ("ר", "Resh", "r", "guttural 'r'", "רוּחַ (spirit/breath)"),
    ("שׁ שׂ", "Shin/Sin", "sh/s", "'sh' with right dot; 's' with left dot", "שָׁלוֹם (peace)"),
    ("ת", "Tav", "t/th", "'t' as in truth", "תּוֹרָה (Torah/law)"),
]


async def seed_courses(db: AsyncSession) -> int:
    """Seed Unit 1 of Greek and Hebrew courses if not already seeded."""
    existing = await db.execute(select(LanguageCourse).limit(1))
    if existing.scalar_one_or_none():
        return 0

    inserted = 0

    # ── Greek Course ──────────────────────────────────────────────────────
    greek = LanguageCourse(
        language="greek",
        slug="biblical-greek",
        title="Biblical Greek",
        description="Learn to read the Greek New Testament from the alphabet through basic grammar.",
        total_units=1,
    )
    db.add(greek)
    await db.flush()

    unit1_gr = CourseUnit(
        course_id=greek.id, unit_number=1,
        title="The Alphabet & Pronunciation",
        description="Master the 24 Greek letters, their names, sounds, and basic writing.",
    )
    db.add(unit1_gr)
    await db.flush()

    # Lesson 1: Introduction to the alphabet
    paradigm_gr = json.dumps([
        {"letter": letter, "name": name, "transliteration": trans,
         "pronunciation": pron, "example": example}
        for letter, name, trans, pron, example in _GREEK_ALPHABET
    ])
    lesson1_gr = CourseLesson(
        unit_id=unit1_gr.id, lesson_number=1,
        title="The 24 Greek Letters",
        instruction=(
            "The Greek alphabet has 24 letters. Most are read left-to-right like English. "
            "Each letter has a capital and lowercase form. Study the table below, paying attention "
            "to pronunciation. Seven letters (α ε η ι ο υ ω) are vowels — all others are consonants. "
            "\n\nSigma has two forms: σ is used at the start or middle of a word; ς at the end. "
            "Some letters look like English but sound different — e.g. η sounds like 'ay', not 'n'."
        ),
        paradigm_table=paradigm_gr,
    )
    db.add(lesson1_gr)
    await db.flush()

    # Exercises: 24 flashcards (letter → name + sound), then 5 multiple choice
    for i, (letter, name, trans, pron, example) in enumerate(_GREEK_ALPHABET):
        db.add(LessonExercise(
            lesson_id=lesson1_gr.id, order=i + 1,
            exercise_type="flashcard",
            prompt=f"What letter is this? {letter}",
            answer=f"{name} ({trans}) — pronounced: {pron}",
            hint=f"Example word: {example}",
        ))

    mc_questions = [
        ("Which letter is transliterated as 'th'?", "Theta (Θ θ)", ["Alpha (Α α)", "Tau (Τ τ)", "Pi (Π π)"]),
        ("Which letter sounds like 'ph' or 'f'?", "Phi (Φ φ)", ["Pi (Π π)", "Psi (Ψ ψ)", "Rho (Ρ ρ)"]),
        ("Which letter is SILENT (a glottal stop marker)?", "Alpha is not silent — Aleph is (Hebrew). In Greek, no letter is fully silent.", ["Eta (Η η)", "Iota (Ι ι)", "Upsilon (Υ υ)"]),
        ("The word λόγος (logos) begins with which letter?", "Lambda (Λ λ)", ["Gamma (Γ γ)", "Nu (Ν ν)", "Mu (Μ μ)"]),
        ("Which form of Sigma appears at the END of a word?", "ς (final sigma)", ["σ (medial sigma)", "Ψ (Psi)", "Ξ (Xi)"]),
    ]
    for i, (prompt, answer, distractors) in enumerate(mc_questions):
        db.add(LessonExercise(
            lesson_id=lesson1_gr.id, order=len(_GREEK_ALPHABET) + i + 1,
            exercise_type="multiple_choice",
            prompt=prompt, answer=answer,
            distractors=json.dumps(distractors),
        ))

    # Lesson 2: Vowels and diphthongs
    lesson2_gr = CourseLesson(
        unit_id=unit1_gr.id, lesson_number=2,
        title="Vowels and Diphthongs",
        instruction=(
            "Greek has 7 vowels: α ε η ι ο υ ω. Short vowels are ε and ο. Long vowels are η and ω. "
            "α ι υ can be either short or long depending on context.\n\n"
            "**Diphthongs** are two-vowel combinations that form a single sound:\n"
            "- αι = 'ai' as in aisle\n"
            "- αυ = 'ow' as in now\n"
            "- ει = 'ei' as in eight\n"
            "- ευ = 'eu' as in feud\n"
            "- οι = 'oi' as in oil\n"
            "- ου = 'oo' as in food\n"
            "- υι = 'we' (rare)\n\n"
            "**Iota subscript** (ᾳ, ῃ, ῳ) is written below a long vowel and is not pronounced in modern Greek."
        ),
        paradigm_table=json.dumps([
            {"type": "diphthong", "combination": "αι", "sound": "ai (aisle)", "example": "αἴρω (I take up)"},
            {"type": "diphthong", "combination": "αυ", "sound": "ow (now)", "example": "αὐτός (he/self)"},
            {"type": "diphthong", "combination": "ει", "sound": "ei (eight)", "example": "εἰρήνη (peace)"},
            {"type": "diphthong", "combination": "ευ", "sound": "eu (feud)", "example": "εὐαγγέλιον (gospel)"},
            {"type": "diphthong", "combination": "οι", "sound": "oi (oil)", "example": "οἶκος (house)"},
            {"type": "diphthong", "combination": "ου", "sound": "oo (food)", "example": "οὐρανός (heaven)"},
        ]),
    )
    db.add(lesson2_gr)
    await db.flush()

    diphthong_exercises = [
        ("How is 'ου' pronounced?", "oo (as in food)", ["ow (as in now)", "oh (as in go)", "oy (as in boy)"]),
        ("The word εὐαγγέλιον (gospel) begins with which diphthong?", "ευ (eu)", ["αυ (au)", "ου (ou)", "αι (ai)"]),
        ("What does the iota subscript indicate?", "A historically long vowel; iota is not pronounced in modern Greek", ["A short vowel", "An accent mark", "A breathing mark"]),
        ("Which diphthong sounds like 'ai' in aisle?", "αι", ["αυ", "ει", "οι"]),
        ("How is 'ει' pronounced?", "ei (as in eight)", ["ee (as in feet)", "i (as in sit)", "ai (as in aisle)"]),
    ]
    for i, (prompt, answer, distractors) in enumerate(diphthong_exercises):
        db.add(LessonExercise(
            lesson_id=lesson2_gr.id, order=i + 1,
            exercise_type="multiple_choice",
            prompt=prompt, answer=answer,
            distractors=json.dumps(distractors),
        ))

    inserted += 2  # 2 lessons for Greek

    # ── Hebrew Course ─────────────────────────────────────────────────────
    hebrew = LanguageCourse(
        language="hebrew",
        slug="biblical-hebrew",
        title="Biblical Hebrew",
        description="Learn to read the Hebrew Old Testament from the alphabet through basic vocabulary and pointing.",
        total_units=1,
    )
    db.add(hebrew)
    await db.flush()

    unit1_he = CourseUnit(
        course_id=hebrew.id, unit_number=1,
        title="The Alphabet and Vowel Points",
        description="Master the 22 Hebrew letters, their names, sounds, and the Masoretic vowel pointing system.",
    )
    db.add(unit1_he)
    await db.flush()

    paradigm_he = json.dumps([
        {"letter": letter, "name": name, "transliteration": trans,
         "pronunciation": pron, "example": example}
        for letter, name, trans, pron, example in _HEBREW_ALPHABET
    ])
    lesson1_he = CourseLesson(
        unit_id=unit1_he.id, lesson_number=1,
        title="The 22 Hebrew Letters",
        instruction=(
            "Hebrew is written right-to-left and has 22 consonants. There are no separate capital letters. "
            "Five letters have a different form when they appear at the END of a word — these are called "
            "final (sofit) forms: כ→ך מ→ם נ→ן פ→ף צ→ץ.\n\n"
            "Six letters (BeGaDKePhaT: ב ג ד כ פ ת) have two pronunciations: a harder sound when they have "
            "a dot (dagesh lene) and a softer sound without it.\n\n"
            "Hebrew consonants originally had no written vowels — vowel points (nikud) were added by the "
            "Masoretes (6th–10th centuries AD) to preserve pronunciation."
        ),
        paradigm_table=paradigm_he,
    )
    db.add(lesson1_he)
    await db.flush()

    for i, (letter, name, trans, pron, example) in enumerate(_HEBREW_ALPHABET):
        db.add(LessonExercise(
            lesson_id=lesson1_he.id, order=i + 1,
            exercise_type="flashcard",
            prompt=f"Name this letter: {letter}",
            answer=f"{name} ({trans}) — {pron}",
            hint=f"Example: {example}",
        ))

    heb_mc = [
        ("Which 5 letters have special FINAL forms?", "כ מ נ פ צ (Kaf, Mem, Nun, Pe, Tsade)", ["א ב ג ד ה", "ו ז ח ט י", "ל ס ע ק ר"]),
        ("What is the name of the vowel pointing system added by the Masoretes?", "Nikud (נִקּוּד)", ["Dagesh", "Qere", "Kethiv"]),
        ("The word שָׁלוֹם (shalom/peace) begins with which letter?", "Shin (שׁ)", ["Samech (ס)", "Sin (שׂ)", "Tsade (צ)"]),
        ("Which Hebrew letter is SILENT (like a glottal stop)?", "Aleph (א)", ["Ayin (ע)", "He (ה)", "Vav (ו)"]),
        ("What does the dagesh lene (dot) inside a letter indicate?", "A harder stop pronunciation (e.g. ב='b' with dagesh vs 'v' without)", ["A long vowel", "End of sentence", "A silent letter"]),
    ]
    for i, (prompt, answer, distractors) in enumerate(heb_mc):
        db.add(LessonExercise(
            lesson_id=lesson1_he.id, order=len(_HEBREW_ALPHABET) + i + 1,
            exercise_type="multiple_choice",
            prompt=prompt, answer=answer,
            distractors=json.dumps(distractors),
        ))

    lesson2_he = CourseLesson(
        unit_id=unit1_he.id, lesson_number=2,
        title="Hebrew Vowel Points (Nikud)",
        instruction=(
            "The Masoretes added small symbols (points) above, below, and inside consonants to indicate vowels. "
            "These are called **nikud** (נִקּוּד).\n\n"
            "**Long vowels:**\n"
            "- Qamets (ָ) under a letter = 'ah' as in father\n"
            "- Tsere (ֵ) = 'ay' as in they\n"
            "- Holem (וֹ or ֹ) = 'oh' as in go\n"
            "- Shuruq (וּ) = 'oo' as in moon\n"
            "- Hireq gadol (יִ) = 'ee' as in feet\n\n"
            "**Short vowels:**\n"
            "- Patah (ַ) = short 'ah'\n"
            "- Segol (ֶ) = short 'eh' as in bet\n"
            "- Hireq qatan (ִ) = short 'ih'\n"
            "- Qibbuts (ֻ) = short 'oo'\n"
            "- Holem haser (ֹ) = short 'oh'\n\n"
            "**Sheva (ְ):** A half-vowel. Vocal sheva = very short 'e'; silent sheva closes the syllable."
        ),
        paradigm_table=json.dumps([
            {"name": "Qamets", "symbol": "ָ", "sound": "ah (long)", "example": "אָב (father)"},
            {"name": "Patah", "symbol": "ַ", "sound": "ah (short)", "example": "עַם (people)"},
            {"name": "Tsere", "symbol": "ֵ", "sound": "ay (long)", "example": "שֵׁם (name)"},
            {"name": "Segol", "symbol": "ֶ", "sound": "eh (short)", "example": "בֶּן (son)"},
            {"name": "Hireq", "symbol": "ִ / יִ", "sound": "ih/ee", "example": "מִי (who)"},
            {"name": "Holem", "symbol": "ֹ / וֹ", "sound": "oh", "example": "קוֹל (voice)"},
            {"name": "Shuruq", "symbol": "וּ", "sound": "oo (long)", "example": "רוּחַ (spirit)"},
            {"name": "Qibbuts", "symbol": "ֻ", "sound": "oo (short)", "example": "כֻּלָּם (all of them)"},
            {"name": "Sheva", "symbol": "ְ", "sound": "silent or very short 'e'", "example": "דְּבַר (word of)"},
        ]),
    )
    db.add(lesson2_he)
    await db.flush()

    nikud_mc = [
        ("Which vowel point makes an 'ah' sound (like in father)?", "Qamets (ָ)", ["Segol (ֶ)", "Tsere (ֵ)", "Sheva (ְ)"]),
        ("The vowel point Tsere (ֵ) sounds like:", "'ay' as in they", ["'ah' as in father", "'oh' as in go", "'oo' as in moon"]),
        ("What is a Sheva (ְ)?", "A half-vowel: vocal (short 'e') or silent (syllable closer)", ["A long 'a' sound", "A doubled consonant marker", "A guttural letter marker"]),
        ("Shuruq (וּ) consists of:", "A Vav with a dot in the middle, sounding 'oo'", ["Patah under any letter", "Two Yods", "A Holem over Aleph"]),
        ("How many distinct vowel signs (including Sheva) are in the basic Masoretic system?", "9 primary vowels + Sheva = 10 symbols", ["5", "7", "26"]),
    ]
    for i, (prompt, answer, distractors) in enumerate(nikud_mc):
        db.add(LessonExercise(
            lesson_id=lesson2_he.id, order=i + 1,
            exercise_type="multiple_choice",
            prompt=prompt, answer=answer,
            distractors=json.dumps(distractors),
        ))

    inserted += 2  # 2 lessons for Hebrew

    await db.commit()
    return inserted


# ── Response helpers ─────────────────────────────────────────────────────────


def _exercise_dict(e: LessonExercise) -> dict:
    return {
        "id": e.id,
        "order": e.order,
        "exercise_type": e.exercise_type,
        "prompt": e.prompt,
        "answer": e.answer,
        "distractors": json.loads(e.distractors) if e.distractors else [],
        "hint": e.hint,
    }


def _lesson_dict(l: CourseLesson, exercises: list | None = None) -> dict:
    d = {
        "id": l.id,
        "unit_id": l.unit_id,
        "lesson_number": l.lesson_number,
        "title": l.title,
        "instruction": l.instruction,
        "paradigm_table": json.loads(l.paradigm_table) if l.paradigm_table else None,
    }
    if exercises is not None:
        d["exercises"] = [_exercise_dict(e) for e in exercises]
        d["exercise_count"] = len(exercises)
    return d


def _unit_dict(u: CourseUnit, lessons: list | None = None) -> dict:
    d = {
        "id": u.id,
        "course_id": u.course_id,
        "unit_number": u.unit_number,
        "title": u.title,
        "description": u.description,
    }
    if lessons is not None:
        d["lessons"] = [_lesson_dict(l) for l in lessons]
        d["lesson_count"] = len(lessons)
    return d


def _progress_dict(p: UserCourseProgress) -> dict:
    return {
        "course_id": p.course_id,
        "current_unit": p.current_unit,
        "current_lesson": p.current_lesson,
        "completed_lesson_ids": json.loads(p.completed_lesson_ids or "[]"),
        "percent_complete": p.percent_complete,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ── Routes ───────────────────────────────────────────────────────────────────


@router.get("")
async def list_courses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LanguageCourse).order_by(LanguageCourse.language))
    courses = result.scalars().all()
    return {
        "courses": [
            {
                "id": c.id,
                "language": c.language,
                "slug": c.slug,
                "title": c.title,
                "description": c.description,
                "total_units": c.total_units,
            }
            for c in courses
        ]
    }


@router.get("/{language}")
async def get_course(language: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LanguageCourse).where(LanguageCourse.language == language.lower())
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail=f"No course found for language: {language}")

    units_q = await db.execute(
        select(CourseUnit)
        .where(CourseUnit.course_id == course.id)
        .order_by(CourseUnit.unit_number)
    )
    units = list(units_q.scalars().all())

    unit_ids = [u.id for u in units]
    lessons_map: dict[int, list] = {uid: [] for uid in unit_ids}
    if unit_ids:
        lessons_q = await db.execute(
            select(CourseLesson)
            .where(CourseLesson.unit_id.in_(unit_ids))
            .order_by(CourseLesson.unit_id, CourseLesson.lesson_number)
        )
        for lesson in lessons_q.scalars().all():
            lessons_map[lesson.unit_id].append(lesson)

    return {
        "id": course.id,
        "language": course.language,
        "slug": course.slug,
        "title": course.title,
        "description": course.description,
        "total_units": course.total_units,
        "units": [_unit_dict(u, lessons=lessons_map[u.id]) for u in units],
    }


@router.get("/{language}/units/{unit_number}")
async def get_unit(language: str, unit_number: int, db: AsyncSession = Depends(get_db)):
    course_q = await db.execute(
        select(LanguageCourse).where(LanguageCourse.language == language.lower())
    )
    course = course_q.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail=f"No course for language: {language}")

    unit_q = await db.execute(
        select(CourseUnit).where(
            CourseUnit.course_id == course.id,
            CourseUnit.unit_number == unit_number,
        )
    )
    unit = unit_q.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail=f"Unit {unit_number} not found")

    lessons_q = await db.execute(
        select(CourseLesson)
        .where(CourseLesson.unit_id == unit.id)
        .order_by(CourseLesson.lesson_number)
    )
    lessons = list(lessons_q.scalars().all())

    return _unit_dict(unit, lessons=lessons)


@router.get("/{language}/units/{unit_number}/lessons/{lesson_number}")
async def get_lesson(
    language: str, unit_number: int, lesson_number: int,
    db: AsyncSession = Depends(get_db),
):
    course_q = await db.execute(
        select(LanguageCourse).where(LanguageCourse.language == language.lower())
    )
    course = course_q.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail=f"No course for language: {language}")

    unit_q = await db.execute(
        select(CourseUnit).where(
            CourseUnit.course_id == course.id,
            CourseUnit.unit_number == unit_number,
        )
    )
    unit = unit_q.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail=f"Unit {unit_number} not found")

    lesson_q = await db.execute(
        select(CourseLesson).where(
            CourseLesson.unit_id == unit.id,
            CourseLesson.lesson_number == lesson_number,
        )
    )
    lesson = lesson_q.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail=f"Lesson {lesson_number} not found")

    exercises_q = await db.execute(
        select(LessonExercise)
        .where(LessonExercise.lesson_id == lesson.id)
        .order_by(LessonExercise.order)
    )
    exercises = list(exercises_q.scalars().all())

    return _lesson_dict(lesson, exercises=exercises)


class ProgressUpdate(BaseModel):
    current_unit: Optional[int] = None
    current_lesson: Optional[int] = None
    completed_lesson_id: Optional[int] = None  # lesson ID to mark complete
    total_lessons: Optional[int] = None  # for % calculation


@router.get("/{language}/progress")
async def get_progress(
    language: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    course_q = await db.execute(
        select(LanguageCourse).where(LanguageCourse.language == language.lower())
    )
    course = course_q.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail=f"No course for language: {language}")

    prog_q = await db.execute(
        select(UserCourseProgress).where(
            UserCourseProgress.user_id == user.id,
            UserCourseProgress.course_id == course.id,
        )
    )
    prog = prog_q.scalar_one_or_none()
    if not prog:
        return {"course_id": course.id, "current_unit": 1, "current_lesson": 1,
                "completed_lesson_ids": [], "percent_complete": 0.0}
    return _progress_dict(prog)


@router.post("/{language}/progress")
async def update_progress(
    language: str,
    body: ProgressUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    course_q = await db.execute(
        select(LanguageCourse).where(LanguageCourse.language == language.lower())
    )
    course = course_q.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail=f"No course for language: {language}")

    prog_q = await db.execute(
        select(UserCourseProgress).where(
            UserCourseProgress.user_id == user.id,
            UserCourseProgress.course_id == course.id,
        )
    )
    prog = prog_q.scalar_one_or_none()
    if not prog:
        prog = UserCourseProgress(
            user_id=user.id,
            course_id=course.id,
            completed_lesson_ids="[]",
        )
        db.add(prog)
        await db.flush()

    if body.current_unit is not None:
        prog.current_unit = body.current_unit
    if body.current_lesson is not None:
        prog.current_lesson = body.current_lesson
    if body.completed_lesson_id is not None:
        completed = json.loads(prog.completed_lesson_ids or "[]")
        if body.completed_lesson_id not in completed:
            completed.append(body.completed_lesson_id)
            prog.completed_lesson_ids = json.dumps(completed)
    if body.total_lessons and body.total_lessons > 0:
        completed = json.loads(prog.completed_lesson_ids or "[]")
        prog.percent_complete = round(len(completed) / body.total_lessons * 100, 1)

    await db.commit()
    return _progress_dict(prog)
