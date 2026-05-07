# Canonical Bible book data: name, number, testament, chapter count
BOOKS = [
    # Old Testament
    {"name": "Genesis", "abbrev": "Gen", "num": 1, "testament": "OT", "chapters": 50},
    {"name": "Exodus", "abbrev": "Exod", "num": 2, "testament": "OT", "chapters": 40},
    {"name": "Leviticus", "abbrev": "Lev", "num": 3, "testament": "OT", "chapters": 27},
    {"name": "Numbers", "abbrev": "Num", "num": 4, "testament": "OT", "chapters": 36},
    {"name": "Deuteronomy", "abbrev": "Deut", "num": 5, "testament": "OT", "chapters": 34},
    {"name": "Joshua", "abbrev": "Josh", "num": 6, "testament": "OT", "chapters": 24},
    {"name": "Judges", "abbrev": "Judg", "num": 7, "testament": "OT", "chapters": 21},
    {"name": "Ruth", "abbrev": "Ruth", "num": 8, "testament": "OT", "chapters": 4},
    {"name": "1 Samuel", "abbrev": "1Sam", "num": 9, "testament": "OT", "chapters": 31},
    {"name": "2 Samuel", "abbrev": "2Sam", "num": 10, "testament": "OT", "chapters": 24},
    {"name": "1 Kings", "abbrev": "1Kgs", "num": 11, "testament": "OT", "chapters": 22},
    {"name": "2 Kings", "abbrev": "2Kgs", "num": 12, "testament": "OT", "chapters": 25},
    {"name": "1 Chronicles", "abbrev": "1Chr", "num": 13, "testament": "OT", "chapters": 29},
    {"name": "2 Chronicles", "abbrev": "2Chr", "num": 14, "testament": "OT", "chapters": 36},
    {"name": "Ezra", "abbrev": "Ezra", "num": 15, "testament": "OT", "chapters": 10},
    {"name": "Nehemiah", "abbrev": "Neh", "num": 16, "testament": "OT", "chapters": 13},
    {"name": "Esther", "abbrev": "Esth", "num": 17, "testament": "OT", "chapters": 10},
    {"name": "Job", "abbrev": "Job", "num": 18, "testament": "OT", "chapters": 42},
    {"name": "Psalms", "abbrev": "Ps", "num": 19, "testament": "OT", "chapters": 150},
    {"name": "Proverbs", "abbrev": "Prov", "num": 20, "testament": "OT", "chapters": 31},
    {"name": "Ecclesiastes", "abbrev": "Eccl", "num": 21, "testament": "OT", "chapters": 12},
    {"name": "Song of Solomon", "abbrev": "Song", "num": 22, "testament": "OT", "chapters": 8},
    {"name": "Isaiah", "abbrev": "Isa", "num": 23, "testament": "OT", "chapters": 66},
    {"name": "Jeremiah", "abbrev": "Jer", "num": 24, "testament": "OT", "chapters": 52},
    {"name": "Lamentations", "abbrev": "Lam", "num": 25, "testament": "OT", "chapters": 5},
    {"name": "Ezekiel", "abbrev": "Ezek", "num": 26, "testament": "OT", "chapters": 48},
    {"name": "Daniel", "abbrev": "Dan", "num": 27, "testament": "OT", "chapters": 12},
    {"name": "Hosea", "abbrev": "Hos", "num": 28, "testament": "OT", "chapters": 14},
    {"name": "Joel", "abbrev": "Joel", "num": 29, "testament": "OT", "chapters": 3},
    {"name": "Amos", "abbrev": "Amos", "num": 30, "testament": "OT", "chapters": 9},
    {"name": "Obadiah", "abbrev": "Obad", "num": 31, "testament": "OT", "chapters": 1},
    {"name": "Jonah", "abbrev": "Jonah", "num": 32, "testament": "OT", "chapters": 4},
    {"name": "Micah", "abbrev": "Mic", "num": 33, "testament": "OT", "chapters": 7},
    {"name": "Nahum", "abbrev": "Nah", "num": 34, "testament": "OT", "chapters": 3},
    {"name": "Habakkuk", "abbrev": "Hab", "num": 35, "testament": "OT", "chapters": 3},
    {"name": "Zephaniah", "abbrev": "Zeph", "num": 36, "testament": "OT", "chapters": 3},
    {"name": "Haggai", "abbrev": "Hag", "num": 37, "testament": "OT", "chapters": 2},
    {"name": "Zechariah", "abbrev": "Zech", "num": 38, "testament": "OT", "chapters": 14},
    {"name": "Malachi", "abbrev": "Mal", "num": 39, "testament": "OT", "chapters": 4},
    # New Testament
    {"name": "Matthew", "abbrev": "Matt", "num": 40, "testament": "NT", "chapters": 28},
    {"name": "Mark", "abbrev": "Mark", "num": 41, "testament": "NT", "chapters": 16},
    {"name": "Luke", "abbrev": "Luke", "num": 42, "testament": "NT", "chapters": 24},
    {"name": "John", "abbrev": "John", "num": 43, "testament": "NT", "chapters": 21},
    {"name": "Acts", "abbrev": "Acts", "num": 44, "testament": "NT", "chapters": 28},
    {"name": "Romans", "abbrev": "Rom", "num": 45, "testament": "NT", "chapters": 16},
    {"name": "1 Corinthians", "abbrev": "1Cor", "num": 46, "testament": "NT", "chapters": 16},
    {"name": "2 Corinthians", "abbrev": "2Cor", "num": 47, "testament": "NT", "chapters": 13},
    {"name": "Galatians", "abbrev": "Gal", "num": 48, "testament": "NT", "chapters": 6},
    {"name": "Ephesians", "abbrev": "Eph", "num": 49, "testament": "NT", "chapters": 6},
    {"name": "Philippians", "abbrev": "Phil", "num": 50, "testament": "NT", "chapters": 4},
    {"name": "Colossians", "abbrev": "Col", "num": 51, "testament": "NT", "chapters": 4},
    {"name": "1 Thessalonians", "abbrev": "1Thess", "num": 52, "testament": "NT", "chapters": 5},
    {"name": "2 Thessalonians", "abbrev": "2Thess", "num": 53, "testament": "NT", "chapters": 3},
    {"name": "1 Timothy", "abbrev": "1Tim", "num": 54, "testament": "NT", "chapters": 6},
    {"name": "2 Timothy", "abbrev": "2Tim", "num": 55, "testament": "NT", "chapters": 4},
    {"name": "Titus", "abbrev": "Titus", "num": 56, "testament": "NT", "chapters": 3},
    {"name": "Philemon", "abbrev": "Phlm", "num": 57, "testament": "NT", "chapters": 1},
    {"name": "Hebrews", "abbrev": "Heb", "num": 58, "testament": "NT", "chapters": 13},
    {"name": "James", "abbrev": "Jas", "num": 59, "testament": "NT", "chapters": 5},
    {"name": "1 Peter", "abbrev": "1Pet", "num": 60, "testament": "NT", "chapters": 5},
    {"name": "2 Peter", "abbrev": "2Pet", "num": 61, "testament": "NT", "chapters": 3},
    {"name": "1 John", "abbrev": "1John", "num": 62, "testament": "NT", "chapters": 5},
    {"name": "2 John", "abbrev": "2John", "num": 63, "testament": "NT", "chapters": 1},
    {"name": "3 John", "abbrev": "3John", "num": 64, "testament": "NT", "chapters": 1},
    {"name": "Jude", "abbrev": "Jude", "num": 65, "testament": "NT", "chapters": 1},
    {"name": "Revelation", "abbrev": "Rev", "num": 66, "testament": "NT", "chapters": 22},
]

BOOK_NAME_MAP = {b["name"].lower(): b for b in BOOKS}
BOOK_ABBREV_MAP = {b["abbrev"].lower(): b for b in BOOKS}
BOOK_NUM_MAP = {b["num"]: b for b in BOOKS}

# Also map common variations
_ALIASES = {
    "gen": "Genesis", "ex": "Exodus", "exo": "Exodus", "lev": "Leviticus",
    "num": "Numbers", "deu": "Deuteronomy", "jos": "Joshua", "jdg": "Judges",
    "1sa": "1 Samuel", "2sa": "2 Samuel", "1ki": "1 Kings", "2ki": "2 Kings",
    "1ch": "1 Chronicles", "2ch": "2 Chronicles", "ezr": "Ezra", "neh": "Nehemiah",
    "est": "Esther", "psa": "Psalms", "pro": "Proverbs", "ecc": "Ecclesiastes",
    "sng": "Song of Solomon", "sos": "Song of Solomon", "isa": "Isaiah",
    "jer": "Jeremiah", "lam": "Lamentations", "eze": "Ezekiel", "dan": "Daniel",
    "hos": "Hosea", "amo": "Amos", "oba": "Obadiah", "jon": "Jonah",
    "mic": "Micah", "nah": "Nahum", "hab": "Habakkuk", "zep": "Zephaniah",
    "hag": "Haggai", "zec": "Zechariah", "mal": "Malachi",
    "mat": "Matthew", "mr": "Mark", "luk": "Luke", "joh": "John",
    "jn": "John", "act": "Acts", "rom": "Romans", "1co": "1 Corinthians",
    "2co": "2 Corinthians", "gal": "Galatians", "eph": "Ephesians",
    "php": "Philippians", "col": "Colossians", "1th": "1 Thessalonians",
    "2th": "2 Thessalonians", "1ti": "1 Timothy", "2ti": "2 Timothy",
    "tit": "Titus", "phm": "Philemon", "heb": "Hebrews", "jas": "James",
    "1pe": "1 Peter", "2pe": "2 Peter", "1jo": "1 John", "2jo": "2 John",
    "3jo": "3 John", "jud": "Jude", "rev": "Revelation",
}


def resolve_book_name(name: str) -> str | None:
    """Normalize any book name/abbreviation to canonical name."""
    key = name.lower().strip()
    if key in BOOK_NAME_MAP:
        return BOOK_NAME_MAP[key]["name"]
    if key in BOOK_ABBREV_MAP:
        return BOOK_ABBREV_MAP[key]["name"]
    if key in _ALIASES:
        return _ALIASES[key]
    return None
