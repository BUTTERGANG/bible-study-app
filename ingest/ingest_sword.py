#!/usr/bin/env python3
"""
Ingest SWORD Project Bible modules and commentaries into SQLite.

Usage:
    cd /Volumes/T5 EVO/REPLIT/LOGOS-COPYCAT/app
    pip install -r requirements.txt
    python ingest/ingest_sword.py

Reads from: ../library/sword/{bibles,commentaries,lexicons,classics,devotional}/
Writes to:  ./data/bible.db
"""

import os
import sqlite3
import sys
import traceback
import zipfile
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
from bible_data import BOOK_NAME_MAP

APP_DIR = Path(__file__).parent.parent
LIBRARY_DIR = Path(os.getenv("LIBRARY_PATH", APP_DIR.parent / "library"))
DATA_DIR = Path(os.getenv("DATA_PATH", APP_DIR / "data"))
SWORD_DIR = LIBRARY_DIR / "sword"
EXTRACT_DIR = DATA_DIR / "sword_extracted"
DB_PATH = DATA_DIR / "bible.db"

# Translations to ingest (public domain)
BIBLE_MODULES = [
    "KJV", "KJVA", "ASV", "YLT", "Darby", "Webster",
    "Wycliffe", "Rotherham", "NETfree", "NHEB", "OEB",
    "BSB", "LEB",
]

COMMENTARY_MODULES = [
    "MHC", "MHCC", "JFB", "Barnes", "Clarke", "Wesley",
    "TSK", "KD", "RWP", "Geneva", "Luther", "Lightfoot",
    "TFG", "PNT", "TDavid", "Burkitt", "Calvin",
]

LEXICON_MODULES = [
    "StrongsGreek", "StrongsHebrew", "AbbottSmith", "Dodson",
    "Easton", "ISBE", "Smith", "Nave", "Webster1828",
]

# Strong's-keyed lexica go to lexicon_entries.
# Term-keyed dictionaries / encyclopedias go to dictionary_entries.
STRONGS_LEXICON_MODULES = {"StrongsGreek", "StrongsHebrew", "AbbottSmith", "Dodson"}
DICTIONARY_MODULES = {"Easton", "ISBE", "Smith", "Nave", "Webster1828"}


def ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)


def extract_module(zip_path: Path, dest_dir: Path) -> bool:
    """Extract a SWORD zip module to dest_dir."""
    if not zip_path.exists():
        print(f"  MISSING: {zip_path}")
        return False
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(dest_dir)
        return True
    except Exception as e:
        print(f"  ERROR extracting {zip_path.name}: {e}")
        return False


def init_db(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS bible_verses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            translation TEXT NOT NULL,
            book TEXT NOT NULL,
            book_num INTEGER NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            text TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_bv_lookup
            ON bible_verses(translation, book, chapter, verse);
        CREATE INDEX IF NOT EXISTS idx_bv_book
            ON bible_verses(translation, book_num, chapter);

        CREATE VIRTUAL TABLE IF NOT EXISTS bible_verses_fts
            USING fts5(text, content=bible_verses, content_rowid=id);

        CREATE TABLE IF NOT EXISTS commentary_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            book TEXT NOT NULL,
            chapter INTEGER NOT NULL,
            verse_start INTEGER NOT NULL,
            verse_end INTEGER,
            text TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ce_lookup
            ON commentary_entries(source, book, chapter, verse_start);

        CREATE VIRTUAL TABLE IF NOT EXISTS commentary_fts
            USING fts5(text, content=commentary_entries, content_rowid=id);

        CREATE TABLE IF NOT EXISTS lexicon_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            strongs_num TEXT NOT NULL,
            original_word TEXT,
            transliteration TEXT,
            pronunciation TEXT,
            definition TEXT NOT NULL,
            usage TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_lex_strongs
            ON lexicon_entries(strongs_num);

        CREATE TABLE IF NOT EXISTS dictionary_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            term TEXT NOT NULL,
            text TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_dict_term
            ON dictionary_entries(term COLLATE NOCASE);

        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference TEXT NOT NULL,
            book TEXT NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER,
            content TEXT NOT NULL,
            tags TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS highlights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            translation TEXT NOT NULL,
            book TEXT NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            color TEXT DEFAULT 'yellow',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference TEXT NOT NULL,
            book TEXT NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER,
            note TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS reading_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            schedule_json TEXT NOT NULL,
            start_date TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS reading_plan_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            reference TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (plan_id) REFERENCES reading_plans(id)
        );
        CREATE TABLE IF NOT EXISTS studies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content_json TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS library_books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT,
            category TEXT NOT NULL,
            source_format TEXT NOT NULL,
            source_path TEXT NOT NULL,
            page_count INTEGER,
            ingested_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS greek_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book TEXT NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            word_position INTEGER NOT NULL,
            greek TEXT NOT NULL,
            transliteration TEXT,
            morphology TEXT,
            strongs_num TEXT,
            english_gloss TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_gw_ref
            ON greek_words(book, chapter, verse);
        CREATE TABLE IF NOT EXISTS hebrew_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book TEXT NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            word_position INTEGER NOT NULL,
            hebrew TEXT NOT NULL,
            transliteration TEXT,
            morphology TEXT,
            strongs_num TEXT,
            english_gloss TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_hw_ref
            ON hebrew_words(book, chapter, verse);
    """)
    conn.commit()
    print("Database schema initialized.")


def _get_actual_module_name(available: dict, module_name: str):
    """Return the actual key in available dict, case-insensitive."""
    if module_name in available:
        return module_name
    lower_keys = {k.lower(): k for k in available.keys()}
    return lower_keys.get(module_name.lower())


def ingest_bible_with_pysword(module_name: str, extract_dir: Path, conn: sqlite3.Connection):
    """Ingest a Bible module using pysword."""
    try:
        from bible_data import resolve_book_name
        from pysword.modules import SwordModules
        modules = SwordModules(str(extract_dir))
        available = modules.parse_modules()

        actual_name = _get_actual_module_name(available, module_name)
        if not actual_name:
            print(f"  Module {module_name} not found (available: {list(available.keys())[:5]}...)")
            return 0

        bible = modules.get_bible_from_module(actual_name)
        struct = bible.get_structure()
        books_dict = struct.get_books()  # {'ot': [...], 'nt': [...]}
        all_books = books_dict.get('ot', []) + books_dict.get('nt', [])

        count = 0
        rows = []
        for book_obj in all_books:
            canonical = resolve_book_name(book_obj.name) or book_obj.name
            book_data = BOOK_NAME_MAP.get(canonical.lower())
            book_num = book_data["num"] if book_data else 0

            for ch_idx, verse_count in enumerate(book_obj.chapter_lengths):
                ch_num = ch_idx + 1
                for v_num in range(1, verse_count + 1):
                    try:
                        text = bible.get(
                            books=[book_obj.name],
                            chapters=[ch_num],
                            verses=[v_num],
                            clean=True,
                        )
                        if text and text.strip():
                            rows.append((actual_name, canonical, book_num, ch_num, v_num, text.strip()))
                            count += 1
                    except Exception:
                        pass

                if len(rows) >= 1000:
                    conn.executemany(
                        "INSERT OR IGNORE INTO bible_verses (translation, book, book_num, chapter, verse, text) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        rows,
                    )
                    conn.commit()
                    rows = []

        if rows:
            conn.executemany(
                "INSERT OR IGNORE INTO bible_verses (translation, book, book_num, chapter, verse, text) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                rows,
            )
            conn.commit()

        return count

    except ImportError:
        print("  pysword not installed — falling back to manual parser")
        return ingest_bible_manual(module_name, extract_dir, conn)
    except Exception as e:
        print(f"  ERROR with pysword for {module_name}: {e}")
        traceback.print_exc()
        return ingest_bible_manual(module_name, extract_dir, conn)


def ingest_bible_manual(module_name: str, extract_dir: Path, conn: sqlite3.Connection) -> int:
    """
    Manual SWORD .bzz parser fallback.
    Reads the verse text by parsing the raw compressed SWORD binary format.
    Falls back to osis/plain text files if present.
    """
    # Look for a .conf file to find module path
    mod_lower = module_name.lower()
    conf_paths = list(extract_dir.glob(f"mods.d/{mod_lower}.conf"))
    if not conf_paths:
        conf_paths = list(extract_dir.glob("mods.d/*.conf"))

    # Try to find OSIS or plain text exports
    for ext in ["*.xml", "*.txt", "*.osis"]:
        found = list(extract_dir.rglob(ext))
        if found:
            print(f"  Found text file: {found[0]}")
            # TODO: parse OSIS XML
            return 0

    print(f"  Could not parse {module_name} manually")
    return 0


def rebuild_fts(conn: sqlite3.Connection):
    """Rebuild FTS5 indexes."""
    print("Rebuilding FTS indexes...")
    conn.execute("INSERT INTO bible_verses_fts(bible_verses_fts) VALUES('rebuild')")
    conn.execute("INSERT INTO commentary_fts(commentary_fts) VALUES('rebuild')")
    conn.commit()
    print("FTS indexes rebuilt.")


def register_library_books(conn: sqlite3.Connection):
    """Scan all PDF/epub files in library and register in library_books table."""
    library_dir = LIBRARY_DIR
    category_map = {
        "commentaries": "Commentary",
        "ccel/commentaries": "Commentary",
        "ccel/devotional": "Devotional",
        "ccel/theology": "Theology",
        "ccel/church_history": "Church History",
        "ccel/reference": "Reference",
        "study_bibles": "Study Bible",
        "translations": "Bible Translation",
        "book_notes": "Book Notes",
        "gutenberg/commentaries": "Commentary",
        "gutenberg/theology": "Theology",
        "gutenberg/lexicons": "Lexicons",
    }

    rows = []
    for rel_cat, display_cat in category_map.items():
        cat_dir = library_dir / rel_cat
        if not cat_dir.exists():
            continue
        for f in sorted(cat_dir.iterdir()):
            if f.suffix.lower() in (".pdf", ".epub"):
                title = f.stem.replace("_", " ")
                author = _extract_author(title)
                page_count = None
                if f.suffix.lower() == ".pdf":
                    try:
                        import fitz
                        doc = fitz.open(str(f))
                        page_count = doc.page_count
                        doc.close()
                    except Exception:
                        pass
                rows.append((title, author, display_cat, f.suffix[1:].lower(), str(f), page_count))

    if rows:
        conn.executemany(
            "INSERT OR IGNORE INTO library_books (title, author, category, source_format, source_path, page_count) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        print(f"Registered {len(rows)} library books.")


def _extract_author(title: str) -> str:
    """Best-effort author extraction from filename."""
    known = {
        "Calvin": "John Calvin", "Spurgeon": "C.H. Spurgeon",
        "Matthew_Henry": "Matthew Henry", "Matthew Henry": "Matthew Henry",
        "JFB": "Jamieson, Fausset & Brown", "Barnes": "Albert Barnes",
        "Wesley": "John Wesley", "Clarke": "Adam Clarke",
        "Schaff": "Philip Schaff", "Luther": "Martin Luther",
        "Augustine": "Augustine of Hippo", "Aquinas": "Thomas Aquinas",
    }
    for key, author in known.items():
        if key in title:
            return author
    return ""


def main():
    print("=== SWORD Module Ingestion ===\n")
    ensure_dirs()

    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    init_db(conn)

    # Check what's already ingested
    existing_translations = {
        row[0] for row in conn.execute("SELECT DISTINCT translation FROM bible_verses").fetchall()
    }
    print(f"Already ingested: {existing_translations}\n")

    print("=== EXTRACTING AND INGESTING BIBLE MODULES ===")
    for module in BIBLE_MODULES:
        if module in existing_translations:
            print(f"SKIP (exists): {module}")
            continue

        zip_path = SWORD_DIR / "bibles" / f"{module}.zip"
        module_extract = EXTRACT_DIR / module

        if not module_extract.exists() or not any(module_extract.iterdir()):
            print(f"Extracting {module}...")
            module_extract.mkdir(exist_ok=True)
            if not extract_module(zip_path, module_extract):
                continue

        print(f"Ingesting {module}...")
        count = ingest_bible_with_pysword(module, module_extract, conn)
        print(f"  -> {count} verses ingested")

    print("\n=== EXTRACTING AND INGESTING COMMENTARY MODULES ===")
    existing_commentaries = {
        row[0] for row in conn.execute("SELECT DISTINCT source FROM commentary_entries").fetchall()
    }
    for module in COMMENTARY_MODULES:
        if module in existing_commentaries:
            print(f"SKIP (exists): {module}")
            continue

        zip_path = SWORD_DIR / "commentaries" / f"{module}.zip"
        module_extract = EXTRACT_DIR / module

        if not module_extract.exists() or not any(module_extract.iterdir()):
            print(f"Extracting {module}...")
            module_extract.mkdir(exist_ok=True)
            if not extract_module(zip_path, module_extract):
                continue

        print(f"Ingesting commentary {module}...")
        count = ingest_commentary_with_pysword(module, module_extract, conn)
        print(f"  -> {count} entries ingested")

    print("\n=== EXTRACTING AND INGESTING LEXICON MODULES ===")
    existing_lexicons = {
        row[0] for row in conn.execute("SELECT DISTINCT source FROM lexicon_entries").fetchall()
    }
    for module in LEXICON_MODULES:
        if module in existing_lexicons:
            print(f"SKIP (exists): {module}")
            continue

        # Lexicons may be in lexicons/ or classics/ folder
        zip_path = SWORD_DIR / "lexicons" / f"{module}.zip"
        if not zip_path.exists():
            zip_path = SWORD_DIR / "classics" / f"{module}.zip"

        module_extract = EXTRACT_DIR / module
        if not module_extract.exists() or not any(module_extract.iterdir()):
            print(f"Extracting {module}...")
            module_extract.mkdir(exist_ok=True)
            if not extract_module(zip_path, module_extract):
                continue

        print(f"Ingesting lexicon {module}...")
        count = ingest_lexicon(module, module_extract, conn)
        print(f"  -> {count} entries ingested")

    print("\n=== REGISTERING LIBRARY BOOKS ===")
    register_library_books(conn)

    print("\n=== REBUILDING FTS INDEXES ===")
    try:
        rebuild_fts(conn)
    except Exception as e:
        print(f"  FTS rebuild error (non-fatal): {e}")

    conn.close()
    print(f"\n=== DONE === Database: {DB_PATH}")

    # Show stats
    conn2 = sqlite3.connect(str(DB_PATH))
    verses = conn2.execute("SELECT COUNT(*) FROM bible_verses").fetchone()[0]
    translations = conn2.execute("SELECT COUNT(DISTINCT translation) FROM bible_verses").fetchone()[0]
    commentary = conn2.execute("SELECT COUNT(*) FROM commentary_entries").fetchone()[0]
    library = conn2.execute("SELECT COUNT(*) FROM library_books").fetchone()[0]
    conn2.close()
    print(f"Verses: {verses:,} across {translations} translations")
    print(f"Commentary entries: {commentary:,}")
    print(f"Library books registered: {library}")


def _patch_pysword_for_commentaries():
    """Allow pysword to read zCom/zCom4 modules (same binary format as zText)."""
    try:
        from pysword import bible as pb
        pb.SwordModuleType.ZCOM = 'zcom'
        pb.SwordModuleType.ZCOM4 = 'zcom4'
        pb.SwordModuleType.RAWCOM = 'rawcom'
        pb.SwordModuleType.RAWCOM4 = 'rawcom4'
        pb.SwordBible._MODULE_CLASSES['zcom'] = pb.ZTextModule
        pb.SwordBible._MODULE_CLASSES['zcom4'] = pb.ZTextModule4
        pb.SwordBible._MODULE_CLASSES['rawcom'] = pb.RawTextModule
        pb.SwordBible._MODULE_CLASSES['rawcom4'] = pb.RawTextModule4
        # Patch the validation check
        _original_new = pb.SwordBible.__new__
        def _patched_new(cls, *args, **kwargs):
            module_type = kwargs.get('module_type') or (args[1] if len(args) > 1 else None)
            if module_type and module_type not in pb.SwordBible._MODULE_CLASSES:
                # Force to ztext4 as fallback for unknown com types
                if 'com' in module_type:
                    if '4' in module_type:
                        kwargs['module_type'] = 'ztext4'
                    else:
                        kwargs['module_type'] = 'ztext'
                    args = args[:1]
            return _original_new.__func__(cls, *args, **kwargs) if hasattr(_original_new, '__func__') else _original_new(cls, *args, **kwargs)
    except Exception:
        pass


def ingest_commentary_with_pysword(module_name: str, extract_dir: Path, conn: sqlite3.Connection) -> int:
    try:
        from bible_data import resolve_book_name
        from pysword.modules import SwordModules
        modules = SwordModules(str(extract_dir))
        available = modules.parse_modules()

        actual_name = _get_actual_module_name(available, module_name)
        if not actual_name:
            print(f"  {module_name} not found")
            return 0

        # Rewrite moddrv to ztext/ztext4 so pysword can read it
        mod_info = modules._modules[actual_name]
        moddrv = mod_info.get('moddrv', '').lower()
        if 'com' in moddrv:
            mod_info['moddrv'] = 'zText4' if '4' in moddrv else 'zText'

        commentary = modules.get_bible_from_module(actual_name)
        struct = commentary.get_structure()
        books_dict = struct.get_books()
        all_books = books_dict.get('ot', []) + books_dict.get('nt', [])

        count = 0
        rows = []
        for book_obj in all_books:
            canonical = resolve_book_name(book_obj.name) or book_obj.name

            for ch_idx, verse_count in enumerate(book_obj.chapter_lengths):
                ch_num = ch_idx + 1
                for v_num in range(1, verse_count + 1):
                    try:
                        text = commentary.get(  # commentary is actually a SwordBible object
                            books=[book_obj.name],
                            chapters=[ch_num],
                            verses=[v_num],
                            clean=True,
                        )
                        if text and text.strip():
                            rows.append((module_name, canonical, ch_num, v_num, None, text.strip()))
                            count += 1
                    except Exception:
                        pass

                if len(rows) >= 500:
                    conn.executemany(
                        "INSERT INTO commentary_entries (source, book, chapter, verse_start, verse_end, text) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        rows,
                    )
                    conn.commit()
                    rows = []

        if rows:
            conn.executemany(
                "INSERT INTO commentary_entries (source, book, chapter, verse_start, verse_end, text) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                rows,
            )
            conn.commit()

        return count

    except Exception as e:
        print(f"  ERROR ingesting commentary {module_name}: {e}")
        traceback.print_exc()
        return 0


def _read_rawld_module(conf_path: Path, data_path: Path):
    """
    Parse a SWORD RawLD lexicon/dictionary module.
    Returns list of (key, text) tuples.

    RawLD file layout:
      .idx  6-byte records: (uint32 LE offset_in_dat, uint16 LE length_in_dat)
      .dat  at each (offset, length): key\n<entry_text>
            The key is the first line (up to first \\n). For Strong's entries
            the key line ends with a backslash (e.g. "00001\\") which is stripped.
    """
    import struct as st

    idx_file = data_path.with_suffix('.idx')
    dat_file = data_path.with_suffix('.dat')
    if not idx_file.exists():
        idx_file = Path(str(data_path) + '.idx')
        dat_file = Path(str(data_path) + '.dat')
    if not (idx_file.exists() and dat_file.exists()):
        return []

    results = []
    try:
        idx_data = idx_file.read_bytes()
        dat_data = dat_file.read_bytes()
        num_entries = len(idx_data) // 6
        for i in range(num_entries):
            offset, length = st.unpack_from('<IH', idx_data, i * 6)
            raw = dat_data[offset:offset + length]
            if not raw:
                continue
            try:
                text = raw.decode('utf-8', errors='replace')
            except Exception:
                continue
            # First line is the key (strip trailing backslash used in Strong's entries)
            nl = text.find('\n')
            if nl == -1:
                key = text.strip().rstrip('\\')
                content = ''
            else:
                key = text[:nl].strip().rstrip('\\')
                content = text[nl + 1:].strip()
            if key and content:
                results.append((key, content))
    except Exception as e:
        print(f"  rawLD parse error for {data_path}: {e}")
    return results


def _read_zld_module(conf_path: Path, data_path: Path):
    """
    Parse a SWORD zLD lexicon/dictionary module.
    Returns list of (key, text) tuples.

    zLD file layout (per SWORD libsword docs):
      .idx  array of 8-byte records: (uint32 offset_in_dat, uint32 length_in_dat)
            each record points to one entry header in .dat
      .dat  for each entry: "<KEY>\\n<block_num>:<entry_idx_in_block>\\n"
            where block_num/entry_idx are zero-padded ASCII numbers separated
            by a colon. This is what tells us which decompressed block + which
            null-terminated chunk within it contains the entry text.
      .zdx  array of 12-byte records:
            (uint32 offset_in_zdt, uint32 compressed_size, uint32 uncompressed_size)
      .zdt  zlib-compressed blocks; each decompressed block is a concatenation
            of null-terminated entries.
    """
    import struct as st
    import zlib

    idx_file = data_path.with_suffix('.idx')
    dat_file = data_path.with_suffix('.dat')
    zdx_file = data_path.with_suffix('.zdx')
    zdt_file = data_path.with_suffix('.zdt')

    if not idx_file.exists():
        idx_file = Path(str(data_path) + '.idx')
        dat_file = Path(str(data_path) + '.dat')
        zdx_file = Path(str(data_path) + '.zdx')
        zdt_file = Path(str(data_path) + '.zdt')

    if not all(f.exists() for f in [idx_file, dat_file, zdx_file, zdt_file]):
        return []

    results = []
    try:
        with open(idx_file, 'rb') as f:
            idx_data = f.read()
        with open(dat_file, 'rb') as f:
            dat_data = f.read()
        with open(zdx_file, 'rb') as f:
            zdx_data = f.read()
        with open(zdt_file, 'rb') as f:
            zdt_data = f.read()

        # Parse zdx blocks: 12 bytes each (offset, comp_size, uncomp_size)
        num_blocks = len(zdx_data) // 12
        block_meta = []
        for i in range(num_blocks):
            off, comp_sz, _uncomp_sz = st.unpack_from('<III', zdx_data, i * 12)
            block_meta.append((off, comp_sz))

        # Lazy-decompress each block on demand and cache it. Some modules have
        # hundreds of MB of compressed text — decompressing everything up front
        # blows memory.
        block_cache: dict[int, bytes] = {}

        def get_block(block_num: int) -> bytes:
            if block_num in block_cache:
                return block_cache[block_num]
            if block_num >= len(block_meta):
                return b''
            off, comp_sz = block_meta[block_num]
            try:
                out = zlib.decompress(zdt_data[off:off + comp_sz])
            except Exception:
                out = b''
            block_cache[block_num] = out
            return out

        # Iterate .idx → for each entry, read its header from .dat,
        # extract (key, block_num, entry_idx_within_block), then pull the
        # entry text from the decompressed block.
        num_entries = len(idx_data) // 8
        for i in range(num_entries):
            dat_off, dat_len = st.unpack_from('<II', idx_data, i * 8)
            header = dat_data[dat_off:dat_off + dat_len]
            if not header:
                continue

            # Split off the key (first line) from the pointer line(s).
            # SWORD zLD headers can be either:
            #   "KEY\n<block>:<entry>:<len>\n"   (block_num : entry_idx : maybe length)
            # or sometimes "KEY\n<block>\n<entry>\n" — handle both.
            try:
                text = header.decode('utf-8', errors='replace')
            except Exception:
                continue
            lines = [ln for ln in text.split('\n') if ln.strip()]
            if not lines:
                continue
            key = lines[0].strip()
            if not key:
                continue

            # Find the pointer line — first line that looks like digits[:digits[:digits]]
            block_num = entry_idx = None
            for ln in lines[1:]:
                parts = ln.strip().split(':')
                if len(parts) >= 2 and all(p.strip().isdigit() for p in parts[:2]):
                    block_num = int(parts[0])
                    entry_idx = int(parts[1])
                    break
            if block_num is None or entry_idx is None:
                continue

            block = get_block(block_num)
            if not block:
                continue
            chunks = block.split(b'\x00')
            if entry_idx >= len(chunks):
                continue
            try:
                entry_text = chunks[entry_idx].decode('utf-8', errors='replace').strip()
            except Exception:
                continue
            if entry_text:
                results.append((key, entry_text))

    except Exception as e:
        print(f"  zLD parse error for {data_path}: {e}")

    return results


def ingest_lexicon(module_name: str, extract_dir: Path, conn: sqlite3.Connection) -> int:
    """Ingest a SWORD lexicon/dictionary module using custom zLD parser.

    Routes by module type:
      - STRONGS_LEXICON_MODULES → lexicon_entries (keyed by Strong's number)
      - DICTIONARY_MODULES      → dictionary_entries (keyed by term)
    """
    import re
    try:
        # Find the conf file to locate data path
        conf_files = list(extract_dir.glob("mods.d/*.conf"))
        if not conf_files:
            return 0
        conf_path = conf_files[0]

        # Read conf to get data path
        data_path_rel = None
        with open(conf_path) as f:
            for line in f:
                if line.strip().lower().startswith('datapath='):
                    data_path_rel = line.split('=', 1)[1].strip().lstrip('./')
        if not data_path_rel:
            return 0

        data_path = extract_dir / data_path_rel

        # Detect format: zLD has .zdx/.zdt, rawLD has only .idx/.dat
        zdx = Path(str(data_path) + '.zdx')
        zdx2 = data_path.with_suffix('.zdx')
        is_rawld = not (zdx.exists() or zdx2.exists())

        if is_rawld:
            entries = _read_rawld_module(conf_path, data_path)
        else:
            entries = _read_zld_module(conf_path, data_path)

        if not entries:
            print(f"  Could not parse {module_name} lexicon (0 entries from zLD parser)")
            return 0

        is_strongs = module_name in STRONGS_LEXICON_MODULES
        is_dictionary = module_name in DICTIONARY_MODULES
        # Unknown module: classify by key shape. If most keys look like Strong's
        # codes, treat as a Strong's lexicon; otherwise dictionary.
        if not is_strongs and not is_dictionary:
            sample = entries[:200]
            strongs_like = sum(1 for k, _ in sample if re.match(r'^[GH]\d+', k))
            is_strongs = strongs_like > len(sample) * 0.5
            is_dictionary = not is_strongs

        count = 0
        lex_rows = []
        dict_rows = []
        for key, text in entries:
            clean_text = re.sub(r'<[^>]+>', ' ', text).strip()
            clean_text = re.sub(r'\s+', ' ', clean_text)
            if not clean_text or not key.strip():
                continue
            # Drop entries whose key is a control character (artifact of older
            # zLD parsing); the corrected parser keeps only real headwords.
            if all(ord(c) < 32 for c in key.strip()):
                continue

            if is_strongs:
                m = re.match(r'^([GH]\d+)', key)
                strongs = m.group(1) if m else key
                lex_rows.append(
                    (module_name, strongs, key, "", "", clean_text[:4000], "")
                )
            else:
                dict_rows.append((module_name, key[:200], clean_text[:8000]))
            count += 1

            if len(lex_rows) >= 500:
                conn.executemany(
                    "INSERT INTO lexicon_entries (source, strongs_num, original_word, "
                    "transliteration, pronunciation, definition, usage) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    lex_rows,
                )
                conn.commit()
                lex_rows = []
            if len(dict_rows) >= 500:
                conn.executemany(
                    "INSERT INTO dictionary_entries (source, term, text) VALUES (?, ?, ?)",
                    dict_rows,
                )
                conn.commit()
                dict_rows = []

        if lex_rows:
            conn.executemany(
                "INSERT INTO lexicon_entries (source, strongs_num, original_word, "
                "transliteration, pronunciation, definition, usage) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                lex_rows,
            )
            conn.commit()
        if dict_rows:
            conn.executemany(
                "INSERT INTO dictionary_entries (source, term, text) VALUES (?, ?, ?)",
                dict_rows,
            )
            conn.commit()

        return count

    except Exception as e:
        print(f"  ERROR ingesting lexicon {module_name}: {e}")
        traceback.print_exc()
        return 0


if __name__ == "__main__":
    main()
