from backend.bible_data import BOOKS, resolve_book_name


def test_canonical_name():
    assert resolve_book_name("Genesis") == "Genesis"


def test_case_insensitive():
    assert resolve_book_name("genesis") == "Genesis"
    assert resolve_book_name("GENESIS") == "Genesis"


def test_abbreviation():
    assert resolve_book_name("Gen") == "Genesis"
    assert resolve_book_name("Rev") == "Revelation"


def test_alias():
    assert resolve_book_name("psa") == "Psalms"
    assert resolve_book_name("jn") == "John"


def test_unknown_returns_none():
    assert resolve_book_name("Bogus") is None


def test_66_books_present():
    assert len(BOOKS) == 66
    assert BOOKS[0]["name"] == "Genesis"
    assert BOOKS[-1]["name"] == "Revelation"
