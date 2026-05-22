import struct as st
import zlib
from pathlib import Path

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
            entry = chunks[entry_idx].decode('utf-8', errors='replace')
            results.append((key, entry))
    except Exception as e:
        print(f"Error in _read_zld_module: {e}")
        import traceback
        traceback.print_exc()
        return []
    return results

if __name__ == '__main__':
    data_path = Path('data/sword_extracted/Easton/modules/lexdict/zld/easton/easton')
    conf_path = Path('data/sword_extracted/Easton/mods.d/easton.conf')
    entries = _read_zld_module(conf_path, data_path)
    print(f'Number of entries: {len(entries)}')
    if entries:
        print(f'First entry: {entries[0]}')
        print(f'Last entry: {entries[-1]}')
