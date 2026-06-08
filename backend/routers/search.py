import re

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db

router = APIRouter(prefix="/api/search", tags=["search"])

# Set by lifespan via set_fts_availability(). Avoids the previous pattern of
# catching every exception from an FTS query as "table not built."
_FTS = {"bible": False, "commentary": False}


def set_fts_availability(*, bible: bool, commentary: bool) -> None:
    _FTS["bible"] = bible
    _FTS["commentary"] = commentary


def _sanitize_fts(query: str) -> str:
    """Build an FTS5 prefix-match expression from raw user input.

    Each whitespace-separated token becomes a prefix query (token*) so that
    partial words like 'burning bu' match 'burning bush'. FTS5 special chars
    are stripped from each token to avoid syntax errors.
    """
    # Strip FTS5 special characters; keep only alphanumeric + apostrophe
    tokens = [re.sub(r'[^\w\']', '', t) for t in re.split(r"\s+", query.strip()) if t]
    tokens = [t for t in tokens if t]
    if not tokens:
        return '""'
    return " ".join(t + "*" for t in tokens)


def _term_to_fts(term: str) -> str:
    """Convert a single theme term to an FTS5 expression.

    Multi-word phrases stay quoted (exact phrase match).
    Single words/stems get a prefix wildcard so 'forgiv' matches 'forgiven'.
    """
    if " " in term:
        return '"' + term.replace('"', '""') + '"'
    return re.sub(r'[^\w\']', '', term) + "*"


def _snippet(text_in: str, query: str, max_len: int = 200) -> str:
    """Find the earliest occurrence of any query token and center the snippet
    around it. Previously only used the first token, which often gave a
    snippet far from the actual match for multi-word queries."""
    lower = text_in.lower()
    tokens = [t.lower() for t in re.split(r"\s+", query.strip()) if t]
    pos = -1
    for tok in tokens:
        p = lower.find(tok)
        if p != -1 and (pos == -1 or p < pos):
            pos = p
    if pos == -1:
        return text_in[:max_len]
    start = max(0, pos - 50)
    end = min(len(text_in), pos + 150)
    snippet = text_in[start:end]
    if start > 0:
        snippet = "…" + snippet
    if end < len(text_in):
        snippet = snippet + "…"
    return snippet


@router.get("")
async def search(
    q: str = Query(..., min_length=2),
    scope: str = Query(default="bible", pattern="^(bible|commentary|all)$"),
    translation: str = Query(default="KJV"),
    limit: int = Query(default=25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    results: list = []
    fts_query = _sanitize_fts(q)

    if scope in ("bible", "all"):
        if _FTS["bible"]:
            rows = await db.execute(
                text(
                    """
                    SELECT b.book, b.chapter, b.verse, b.text, b.translation
                    FROM bible_verses_fts fts
                    JOIN bible_verses b ON b.rowid = fts.rowid
                    WHERE fts.text MATCH :query
                      AND lower(b.translation) = lower(:trans)
                    ORDER BY rank
                    LIMIT :lim
                    """
                ),
                {"query": fts_query, "trans": translation, "lim": limit},
            )
        else:
            rows = await db.execute(
                text(
                    """
                    SELECT book, chapter, verse, text, translation
                    FROM bible_verses
                    WHERE lower(translation) = lower(:trans) AND text LIKE :q
                    ORDER BY book_num, chapter, verse
                    LIMIT :lim
                    """
                ),
                {"trans": translation, "q": f"%{q}%", "lim": limit},
            )
        for row in rows:
            results.append({
                "type": "bible",
                "reference": f"{row.book} {row.chapter}:{row.verse}",
                "book": row.book,
                "chapter": row.chapter,
                "verse": row.verse,
                "translation": row.translation,
                "text": row.text,
                "snippet": _snippet(row.text, q),
            })

    if scope in ("commentary", "all") and _FTS["commentary"]:
        rows = await db.execute(
            text(
                """
                SELECT c.source, c.book, c.chapter, c.verse_start, c.text
                FROM commentary_fts fts
                JOIN commentary_entries c ON c.rowid = fts.rowid
                WHERE fts.text MATCH :query
                ORDER BY rank
                LIMIT :lim
                """
            ),
            {"query": fts_query, "lim": max(1, limit // 2)},
        )
        for row in rows:
            results.append({
                "type": "commentary",
                "source": row.source,
                "book": row.book,
                "chapter": row.chapter,
                "verse": row.verse_start,
                "reference": f"{row.book} {row.chapter}:{row.verse_start}",
                "snippet": _snippet(row.text, q),
            })

    return {"query": q, "count": len(results), "results": results}


# ── Semantic / theme search ───────────────────────────────────────────────

# Biblical theme → related search terms. Keys are lower-case user-facing
# theme names; values are FTS stems (partial matches are safe in FTS5).
_THEME_MAP: dict[str, list[str]] = {
    "forgiveness":   ["forgiv", "remission", "pardon", "reconcil"],
    "grace":         ["grace", "gracious", "lovingkindness", "favour", "favor", "mercy"],
    "faith":         ["faith", "believ", "trust"],
    "salvation":     ["salvation", "saved", "savior", "saviour", "redeem", "redemption"],
    "sin":           ["sin", "transgress", "iniquity", "wickedness"],
    "love":          ["love", "loved", "charity", "beloved"],
    "prayer":        ["pray", "prayer", "supplicat", "intercede"],
    "covenant":      ["covenant", "testament", "promise", "oath"],
    "kingdom":       ["kingdom", "reign", "throne"],
    "holy spirit":   ["spirit", "ghost", "comforter", "advocate"],
    "resurrection":  ["resurrect", "risen", "raised from the dead"],
    "messiah":       ["messiah", "christ", "anointed", "king of kings"],
    "peace":         ["peace", "shalom", "reconcil"],
    "wisdom":        ["wisdom", "wise", "understanding"],
    "atonement":     ["atone", "propitiation", "expiation", "sacrifice"],
    "prophecy":      ["prophecy", "prophet", "foretold", "fulfilled"],
    "creation":      ["creat", "creator", "beginning", "heaven and earth"],
    "judgment":      ["judgment", "judge", "wrath", "condemned"],
    "healing":       ["heal", "healed", "restore", "miraculously"],
    "righteousness": ["righteous", "justif", "just"],
    "joy":           ["joy", "rejoice", "gladness", "praise"],
    "suffering":     ["suffer", "afflict", "tribulation", "trial"],
    "eternal life":  ["eternal", "everlasting", "forever", "immortal"],
    "baptism":       ["baptism", "baptize"],
    "worship":       ["worship", "adore", "exalt", "magnify", "glorify"],
    "bread":         ["bread", "loaves", "manna"],
    "light":         ["light", "lamp", "shine", "darkness"],
    "shepherd":      ["shepherd", "sheep", "flock", "pasture"],
    "water":         ["water", "living water", "drink", "thirst"],
    "sacrifice":     ["sacrifice", "offering", "burnt offering", "altar"],
    "temple":        ["temple", "tabernacle", "sanctuary", "holy place"],
    "repentance":    ["repent", "turn", "conversion"],
    "humility":      ["humble", "humility", "meek", "lowly"],
    "anger":         ["anger", "wrath", "furious", "indignation"],
    "fear":          ["fear", "afraid", "tremble", "reverence"],
    "hope":          ["hope", "wait", "expect"],
    "comfort":       ["comfort", "consolation", "strengthen"],
    "strength":      ["strength", "power", "might", "strong"],
    "truth":         ["truth", "true", "honest", "rightfully"],
    "obedience":     ["obey", "obedience", "command", "keep my commandments"],
    "idolatry":      ["idol", "false god", "graven image", "worship of"],
    "poverty":       ["poor", "poverty", "needy", "widow", "orphan"],
    "praise":        ["praise", "hallelujah", "psalm", "sing"],
    "covenant love": ["steadfast love", "lovingkindness", "chesed", "kindness"],
}


def _expand_query(q: str) -> tuple[list[str], str]:
    """Match q against theme keys and expand to synonym terms.

    Returns (matched_themes, fts_OR_expression).
    The fts expression uses FTS5 prefix queries ORed together so a single
    FTS5 search covers all expanded terms.
    """
    q_lower = q.lower()
    # Direct word/phrase matches against theme keys
    matched: list[str] = []
    all_terms: list[str] = []

    for key, terms in _THEME_MAP.items():
        if key in q_lower or any(t.lower() in q_lower or q_lower in t.lower() for t in terms):
            matched.append(key)
            all_terms.extend(terms)

    if not matched:
        # Fall back: use original query tokens as-is
        return [], _sanitize_fts(q)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_terms: list[str] = []
    for t in all_terms:
        if t not in seen:
            seen.add(t)
            unique_terms.append(t)

    # Build FTS5 OR query using prefix for single words, quoted for phrases
    fts_parts = [_term_to_fts(t) for t in unique_terms]
    return matched, " OR ".join(fts_parts)


@router.get("/semantic")
async def semantic_search(
    q: str = Query(..., min_length=2),
    translation: str = Query(default="KJV"),
    limit: int = Query(default=25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Theme-expanded full-text search.

    Matches the query against a biblical theme vocabulary and expands to
    related terms before running FTS. Falls back to regular FTS when no
    theme is detected.
    """
    matched_themes, fts_expr = _expand_query(q)

    results: list = []
    if _FTS["bible"]:
        rows = await db.execute(
            text("""
                SELECT b.book, b.chapter, b.verse, b.text, b.translation
                FROM bible_verses_fts fts
                JOIN bible_verses b ON b.rowid = fts.rowid
                WHERE fts.text MATCH :query
                  AND lower(b.translation) = lower(:trans)
                ORDER BY rank
                LIMIT :lim
            """),
            {"query": fts_expr, "trans": translation, "lim": limit},
        )
        for row in rows:
            results.append({
                "type": "bible",
                "reference": f"{row.book} {row.chapter}:{row.verse}",
                "book": row.book,
                "chapter": row.chapter,
                "verse": row.verse,
                "text": row.text,
                "translation": row.translation,
                "snippet": _snippet(row.text, q),
            })
    else:
        # FTS unavailable — plain LIKE fallback
        rows = await db.execute(
            text("""
                SELECT book, chapter, verse, text, translation
                FROM bible_verses
                WHERE lower(translation) = lower(:trans) AND text LIKE :pat
                LIMIT :lim
            """),
            {"trans": translation, "pat": f"%{q}%", "lim": limit},
        )
        for row in rows:
            results.append({
                "type": "bible",
                "reference": f"{row.book} {row.chapter}:{row.verse}",
                "book": row.book,
                "chapter": row.chapter,
                "verse": row.verse,
                "text": row.text,
                "translation": row.translation,
                "snippet": _snippet(row.text, q),
            })

    return {
        "query": q,
        "matched_themes": matched_themes,
        "expanded": bool(matched_themes),
        "count": len(results),
        "results": results,
    }


# ── Morphological search ──────────────────────────────────────────────────

class MorphSearchRequest(BaseModel):
    language: str = Field(default="greek", pattern="^(greek|hebrew)$")
    part_of_speech: str = Field(default="", max_length=20)
    tense: str = Field(default="", max_length=20)
    voice: str = Field(default="", max_length=20)
    mood: str = Field(default="", max_length=20)
    person: str = Field(default="", max_length=10)
    number: str = Field(default="", max_length=10)
    gender: str = Field(default="", max_length=10)
    case_: str = Field(default="", alias="case", max_length=20)
    scope: str = Field(default="all", pattern="^(all|ot|nt|book)$")
    book: str = Field(default="", max_length=50)
    limit: int = Field(default=50, le=200)


# Maps human-readable feature values → morphology code characters.
# Greek (Robinson) codes: POS-TVM[-PNG][-CG]  e.g. V-PAI-3S
_GREEK_POS_MAP = {
    "verb": "V", "noun": "N", "adjective": "A", "pronoun": "P",
    "preposition": "R", "conjunction": "C", "adverb": "D",
    "article": "T", "interjection": "I", "particle": "X", "numeral": "S",
}
_GREEK_TENSE_MAP = {
    "present": "P", "imperfect": "I", "future": "F", "aorist": "A",
    "perfect": "R", "pluperfect": "L",
}
_GREEK_VOICE_MAP = {
    "active": "A", "middle": "M", "passive": "P",
    "middle-passive": "E", "deponent": "D",
}
_GREEK_MOOD_MAP = {
    "indicative": "I", "subjunctive": "S", "optative": "O",
    "imperative": "M", "infinitive": "N", "participle": "P",
}
_GREEK_PERSON_MAP = {"1st": "1", "2nd": "2", "3rd": "3"}
_GREEK_NUMBER_MAP = {"singular": "S", "plural": "P"}
_GREEK_GENDER_MAP = {"masculine": "M", "feminine": "F", "neuter": "N"}
_GREEK_CASE_MAP = {
    "nominative": "N", "genitive": "G", "dative": "D",
    "accusative": "A", "vocative": "V",
}

# Hebrew (Westminster) codes: POS-STEM[-PGN]  e.g. V-Qal-3ms
_HEBREW_POS_MAP = {
    "verb": "V", "noun": "N", "adjective": "A", "pronoun": "P",
    "preposition": "R", "conjunction": "C", "adverb": "D",
    "article": "T", "proper-noun": "S", "interjection": "I", "particle": "X",
}
_HEBREW_STEM_MAP = {
    "qal": "Q", "niphal": "N", "piel": "P", "pual": "I",
    "hiphil": "H", "hophal": "O", "hithpael": "T", "polel": "R",
    "polal": "L", "hithpolel": "M", "hishtaphel": "S",
}
_HEBREW_PERSON_MAP = {"1st": "1", "2nd": "2", "3rd": "3"}
_HEBREW_GENDER_MAP = {"masculine": "m", "feminine": "f"}
_HEBREW_NUMBER_MAP = {"singular": "s", "plural": "p", "dual": "d"}


def _build_greek_morph_conditions(req: MorphSearchRequest) -> tuple[list[str], dict]:
    """Build SQL WHERE conditions for Greek morphology matching.
    Returns (conditions_list, params_dict)."""
    conditions = []
    params = {}

    pos = _GREEK_POS_MAP.get(req.part_of_speech) if req.part_of_speech else None
    tense = _GREEK_TENSE_MAP.get(req.tense) if req.tense else None
    voice = _GREEK_VOICE_MAP.get(req.voice) if req.voice else None
    mood = _GREEK_MOOD_MAP.get(req.mood) if req.mood else None
    person = _GREEK_PERSON_MAP.get(req.person) if req.person else None
    number = _GREEK_NUMBER_MAP.get(req.number) if req.number else None
    gender = _GREEK_GENDER_MAP.get(req.gender) if req.gender else None
    case = _GREEK_CASE_MAP.get(req.case_) if req.case_ else None

    if pos == "V":
        # Verb: morphology = "V-TVM-PN" or "V-TVM-PN-CG"
        # Build a pattern with underscores for unknown positions
        tvm = (tense or "_") + (voice or "_") + (mood or "_")
        if person or number:
            pn = (person or "_") + (number or "_")
        else:
            pn = None
        if case or gender:
            cg = (case or "_") + (gender or "_")
        else:
            cg = None

        if mood == "P" or mood == "N":
            # Participle/infinitive: V-TVM[-CG] (no person-number)
            if cg:
                pattern = f"V-{tvm}-{cg}"
            else:
                pattern = f"V-{tvm}%"
        elif pn and cg:
            pattern = f"V-{tvm}-{pn}-{cg}"
        elif pn:
            pattern = f"V-{tvm}-{pn}"
        else:
            pattern = f"V-{tvm}%"

        conditions.append("w.morphology LIKE :greek_pat")
        params["greek_pat"] = pattern

    elif pos:
        # Non-verb: morphology = "POS-CNG" or "POS-C-N-G" depending on convention.
        # Robinson format: N-NSM = Nominative Singular Masculine (chars concatenated after first dash)
        c = (case or "")
        n = (number or "")
        g = (gender or "")

        if c or n or g:
            # Build the suffix: known chars + underscore for unknown trailing positions
            suffix = ""
            suffix += c if c else ""
            suffix += n if n else ""
            suffix += g if g else ""
            # If we know case but not number/gender, wildcard the rest
            if c and not n and not g:
                pattern = f"{pos}-{c}%"
            elif c and n and not g:
                pattern = f"{pos}-{c}{n}%"
            else:
                # All specified or partial — use exact known chars
                pattern = f"{pos}-{c}{n}{g}"
        else:
            pattern = f"{pos}-%"

        conditions.append("w.morphology LIKE :greek_pat")
        params["greek_pat"] = pattern

    # If no POS but other filters specified, match any morphology containing those features
    if not pos:
        if person or number:
            pn = (person or "_") + (number or "_")
            conditions.append("w.morphology LIKE :greek_pn")
            params["greek_pn"] = f"%-{pn}%"
        if gender:
            conditions.append("w.morphology LIKE :greek_gender")
            params["greek_gender"] = f"%{gender}"

    return conditions, params


def _build_hebrew_morph_conditions(req: MorphSearchRequest) -> tuple[list[str], dict]:
    """Build SQL WHERE conditions for Hebrew morphology matching."""
    conditions = []
    params = {}

    pos = _HEBREW_POS_MAP.get(req.part_of_speech) if req.part_of_speech else None
    stem = _HEBREW_STEM_MAP.get(req.tense) if req.tense else None
    person = _HEBREW_PERSON_MAP.get(req.person) if req.person else None
    gender = _HEBREW_GENDER_MAP.get(req.gender) if req.gender else None
    number = _HEBREW_NUMBER_MAP.get(req.number) if req.number else None

    if pos == "V":
        s = stem or "_"
        if person or gender or number:
            pgn = (person or "_") + (gender or "_") + (number or "_")
            pattern = f"V-{s}-{pgn}"
        else:
            pattern = f"V-{s}%"
        conditions.append("w.morphology LIKE :heb_pat")
        params["heb_pat"] = pattern
    elif pos:
        pattern = f"{pos}-%"
        conditions.append("w.morphology LIKE :heb_pat")
        params["heb_pat"] = pattern

    if not pos:
        if person or gender or number:
            pgn = (person or "_") + (gender or "_") + (number or "_")
            conditions.append("w.morphology LIKE :heb_pgn")
            params["heb_pgn"] = f"%-{pgn}"

    return conditions, params


@router.post("/morph")
async def morphological_search(
    req: MorphSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Search Bible verses by Greek/Hebrew morphological features."""
    table = "greek_words" if req.language == "greek" else "hebrew_words"
    word_col = "greek" if req.language == "greek" else "hebrew"

    # Build morphology conditions
    if req.language == "greek":
        morph_conditions, morph_params = _build_greek_morph_conditions(req)
    else:
        morph_conditions, morph_params = _build_hebrew_morph_conditions(req)

    # If no specific filters at all, return empty
    if not morph_conditions:
        return {"query": req.model_dump(by_alias=False), "count": 0, "results": []}

    # Build the query
    where_clauses = list(morph_conditions)
    params = dict(morph_params)
    params["limit"] = req.limit

    # Scope filtering — use v.book_num from the joined bible_verses row
    if req.scope == "nt":
        where_clauses.append("v.book_num >= 40")
    elif req.scope == "ot":
        where_clauses.append("v.book_num < 40")
    elif req.scope == "book" and req.book:
        where_clauses.append("w.book = :book")
        params["book"] = req.book

    where_sql = " AND ".join(where_clauses)

    query = text(f"""
        SELECT DISTINCT
            w.book, w.chapter, w.verse, w.word_position,
            w.{word_col} AS word,
            w.morphology,
            w.strongs_num,
            w.english_gloss,
            v.text AS verse_text
        FROM {table} w
        JOIN bible_verses v
            ON v.book = w.book AND v.chapter = w.chapter AND v.verse = w.verse
            AND v.translation = 'KJV'
        WHERE {where_sql}
        ORDER BY v.book_num, w.chapter, w.verse, w.word_position
        LIMIT :limit
    """)

    rows = await db.execute(query, params)

    results = []
    for row in rows:
        results.append({
            "type": "morph",
            "reference": f"{row.book} {row.chapter}:{row.verse}",
            "book": row.book,
            "chapter": row.chapter,
            "verse": row.verse,
            "word_position": row.word_position,
            "word": row.word,
            "morphology": row.morphology,
            "strongs_num": row.strongs_num,
            "english_gloss": row.english_gloss,
            "verse_text": row.verse_text,
        })

    return {"query": req.model_dump(by_alias=False), "count": len(results), "results": results}
