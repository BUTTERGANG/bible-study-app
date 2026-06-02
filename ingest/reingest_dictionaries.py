#!/usr/bin/env python3
"""Re-ingest SWORD dictionary/encyclopedia modules into dictionary_entries.

Downloads (or uses cached) five public-domain modules from CrossWire:
  Easton   — Easton's Bible Dictionary (1897)
  ISBE     — International Standard Bible Encyclopedia
  Smith    — Smith's Bible Dictionary
  Nave     — Nave's Topical Bible
  Webster1828 — Webster's Dictionary 1828

Usage:
    cd /home/runner/workspace
    python3 ingest/reingest_dictionaries.py
"""

import re
import sqlite3
import struct
import sys
import tempfile
import urllib.request
import zipfile
import zlib
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "bible.db"
CACHE_DIR = Path("/tmp")

MODULES = [
    ("Easton",      "zLD",    "Easton's Bible Dictionary"),
    ("ISBE",        "zLD",    "International Standard Bible Encyclopedia"),
    ("Smith",       "RawLD",  "Smith's Bible Dictionary"),
    ("Nave",        "zLD",    "Nave's Topical Bible"),
    ("Webster1828", "zLD",    "Webster's Dictionary 1828"),
]
BASE_URL = "https://crosswire.org/ftpmirror/pub/sword/packages/rawzip"


# ── Parsers (self-contained copies so this script has no import from ingest_sword) ──

def _read_rawld(data_path: Path):
    """Parse a SWORD RawLD module → list of (key, text) tuples."""
    idx = data_path.with_suffix(".idx")
    dat = data_path.with_suffix(".dat")
    if not idx.exists():
        idx = Path(str(data_path) + ".idx")
        dat = Path(str(data_path) + ".dat")
    if not idx.exists():
        return []
    idx_data = idx.read_bytes()
    dat_data = dat.read_bytes()
    n = len(idx_data) // 6
    results = []
    for i in range(n):
        offset, length = struct.unpack_from("<IH", idx_data, i * 6)
        raw = dat_data[offset:offset + length].decode("latin-1", errors="replace")
        parts = raw.split("\n", 1)
        key = parts[0].strip().rstrip("\\").strip()
        text = parts[1].strip() if len(parts) > 1 else ""
        if key and text:
            results.append((key, text))
    return results


def _read_zld(data_path: Path):
    """Parse a SWORD zLD module → list of (key, text) tuples.

    Block layout: uint32 n_entries, then n_entries×(uint32 intra_offset, uint32 len),
    then the actual entry texts at those offsets within the same decompressed block.
    The .dat header for each idx entry uses CRLF after the key, then 4+4 bytes for
    (block_num, entry_index_within_block).
    """
    idx_f = Path(str(data_path) + ".idx")
    dat_f = Path(str(data_path) + ".dat")
    zdx_f = Path(str(data_path) + ".zdx")
    zdt_f = Path(str(data_path) + ".zdt")

    if not idx_f.exists():
        idx_f = data_path.with_suffix(".idx")
        dat_f = data_path.with_suffix(".dat")
        zdx_f = data_path.with_suffix(".zdx")
        zdt_f = data_path.with_suffix(".zdt")

    if not all(f.exists() for f in [idx_f, dat_f, zdx_f, zdt_f]):
        return []

    idx_data = idx_f.read_bytes()
    dat_data = dat_f.read_bytes()
    zdx_data = zdx_f.read_bytes()
    zdt_data = zdt_f.read_bytes()

    num_blocks = len(zdx_data) // 8
    block_meta = [struct.unpack_from("<II", zdx_data, i * 8) for i in range(num_blocks)]
    cache: dict[int, bytes] = {}

    def get_block(n: int) -> bytes:
        if n in cache:
            return cache[n]
        if n >= len(block_meta):
            return b""
        off, comp_sz = block_meta[n]
        try:
            out = zlib.decompress(zdt_data[off:off + comp_sz])
        except Exception:
            out = b""
        cache[n] = out
        return out

    def read_entry_from_block(block_num: int, entry_idx: int) -> str:
        block = get_block(block_num)
        if not block or len(block) < 4:
            return ""
        n_in_block = struct.unpack_from("<I", block, 0)[0]
        if entry_idx >= n_in_block:
            return ""
        e_off, e_len = struct.unpack_from("<II", block, 4 + entry_idx * 8)
        raw = block[e_off:e_off + e_len]
        return raw.decode("utf-8", errors="replace").rstrip("\x00").strip()

    results = []
    n_entries = len(idx_data) // 8
    for i in range(n_entries):
        dat_off, dat_len = struct.unpack_from("<II", idx_data, i * 8)
        header = dat_data[dat_off:dat_off + dat_len]
        if not header:
            continue

        # Key is the bytes before the first \r\n
        crlf = header.find(b"\r\n")
        if crlf < 0:
            continue
        try:
            key = header[:crlf].decode("utf-8", errors="replace").strip()
        except Exception:
            continue
        if not key or all(ord(c) < 32 for c in key):
            continue

        # After CRLF: 4 bytes block_num + 4 bytes entry_idx
        rest = header[crlf + 2:]
        if len(rest) < 8:
            continue
        block_num = struct.unpack_from("<I", rest, 0)[0]
        entry_idx = struct.unpack_from("<I", rest, 4)[0]

        entry_text = read_entry_from_block(block_num, entry_idx)
        if key and entry_text:
            results.append((key, entry_text))

    return results


def _clean(text: str) -> str:
    """Strip XML/HTML tags and normalize whitespace."""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ── Download helper ──────────────────────────────────────────────────────────

def get_zip(module: str) -> Path:
    local = CACHE_DIR / f"{module}.zip"
    if local.exists() and local.stat().st_size > 50_000:
        print(f"  Using cached {local}")
        return local
    url = f"{BASE_URL}/{module}.zip"
    print(f"  Downloading {url} ...")
    urllib.request.urlretrieve(url, local)
    print(f"  Downloaded {local.stat().st_size:,} bytes")
    return local


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    conn = sqlite3.connect(DB_PATH)

    # Clear existing dictionary data
    existing = conn.execute("SELECT COUNT(*) FROM dictionary_entries").fetchone()[0]
    if existing:
        print(f"Removing {existing} existing dictionary entries...")
        conn.execute("DELETE FROM dictionary_entries")
        conn.commit()

    grand_total = 0

    for module, drv, description in MODULES:
        print(f"\n=== {module} ({description}) ===")
        zip_path = get_zip(module)

        extract_dir = Path(tempfile.mkdtemp(prefix=f"{module}_"))
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(extract_dir)

        # Find data path from conf
        conf_files = list(extract_dir.glob("mods.d/*.conf"))
        if not conf_files:
            print(f"  No conf file — skipping")
            continue

        data_path_rel = None
        with open(conf_files[0]) as f:
            for line in f:
                if line.strip().lower().startswith("datapath="):
                    data_path_rel = line.split("=", 1)[1].strip().lstrip("./")
        if not data_path_rel:
            print(f"  No DataPath in conf — skipping")
            continue

        data_path = extract_dir / data_path_rel
        print(f"  Data path: {data_path}")

        if drv == "RawLD":
            raw_entries = _read_rawld(data_path)
        else:
            raw_entries = _read_zld(data_path)

        print(f"  Raw entries parsed: {len(raw_entries)}")
        if not raw_entries:
            print(f"  WARNING: 0 entries — check module format")
            continue

        rows = []
        for key, text in raw_entries:
            clean_text = _clean(text)
            if not clean_text or not key.strip():
                continue
            if all(ord(c) < 32 for c in key.strip()):
                continue
            rows.append((module, key.strip()[:200], clean_text[:8000]))

        if rows:
            conn.executemany(
                "INSERT INTO dictionary_entries (source, term, text) VALUES (?, ?, ?)",
                rows,
            )
            conn.commit()
            print(f"  Inserted {len(rows)} entries")
            grand_total += len(rows)
        else:
            print(f"  WARNING: all entries filtered out")

    print(f"\n{'='*50}")
    print(f"Total dictionary entries inserted: {grand_total:,}")

    # Verify
    print("\nPer-source counts:")
    for row in conn.execute(
        "SELECT source, COUNT(*) FROM dictionary_entries GROUP BY source ORDER BY source"
    ).fetchall():
        print(f"  {row[0]}: {row[1]:,}")

    # Spot checks
    print("\nSpot checks:")
    for term, source in [("grace", "Easton"), ("Jerusalem", "ISBE"), ("Moses", "Smith")]:
        row = conn.execute(
            "SELECT term, text FROM dictionary_entries WHERE source=? AND term LIKE ? LIMIT 1",
            (source, f"%{term}%"),
        ).fetchone()
        if row:
            print(f"  {source}/{term}: {row[1][:80]}...")
        else:
            print(f"  {source}/{term}: NOT FOUND")

    conn.close()


if __name__ == "__main__":
    main()
