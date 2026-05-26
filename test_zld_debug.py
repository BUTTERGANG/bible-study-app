import struct as st
import zlib
from pathlib import Path

def _read_zld_module(conf_path: Path, data_path: Path):
    """
    Parse a SWORD zLD lexicon/dictionary module.
    Returns list of (key, text) tuples.
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

    print(f"Checking files:")
    print(f"  idx_file: {idx_file} exists: {idx_file.exists()}")
    print(f"  dat_file: {dat_file} exists: {dat_file.exists()}")
    print(f"  zdx_file: {zdx_file} exists: {zdx_file.exists()}")
    print(f"  zdt_file: {zdt_file} exists: {zdt_file.exists()}")

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

        print(f"File sizes: idx={len(idx_data)}, dat={len(dat_data)}, zdx={len(zdx_data)}, zdt={len(zdt_data)}")

        # Parse zdx blocks: 12 bytes each (offset, comp_size, uncomp_size)
        num_blocks = len(zdx_data) // 12
        print(f"Number of zdx blocks: {num_blocks}")
        block_meta = []
        for i in range(num_blocks):
            off, comp_sz, uncomp_sz = st.unpack_from('<III', zdx_data, i * 12)
            block_meta.append((off, comp_sz, uncomp_sz))
            if i < 3:  # Show first 3 blocks
                print(f"  Block {i}: offset={off}, comp_size={comp_sz}, uncomp_size={uncomp_sz}")

        # Lazy-decompress each block on demand and cache it. Some modules have
        # hundreds of MB of compressed text — decompressing everything up front
        # blows memory.
        block_cache: dict[int, bytes] = {}

        def get_block(block_num: int) -> bytes:
            if block_num in block_cache:
                return block_cache[block_num]
            if block_num >= len(block_meta):
                return b''
            off, comp_sz, _uncomp_sz = block_meta[block_num]
            try:
                out = zlib.decompress(zdt_data[off:off + comp_sz])
            except Exception as e:
                print(f"Error decompressing block {block_num}: {e}")
                out = b''
            block_cache[block_num] = out
            if block_num < 3:  # Show first 3 blocks
                print(f"  Decompressed block {block_num}: length={len(out)}")
            return out

        # Iterate .idx → for each entry, read its header from .dat,
        # extract (key, block_num, entry_idx_within_block), then pull the
        # entry text from the decompressed block.
        num_entries = len(idx_data) // 8
        print(f"Number of entries from idx: {num_entries}")
        for i in range(min(10, num_entries)):  # Check first 10 entries
            dat_off, dat_len = st.unpack_from('<II', idx_data, i * 8)
            header = dat_data[dat_off:dat_off + dat_len]
            if not header:
                print(f"  Entry {i}: empty header")
                continue

            # Split off the key (first line) from the pointer line(s).
            # SWORD zLD headers can be either:
            #   "KEY\n<block>:<entry>:<len>\n"   (block_num : entry_idx : maybe length)
            # or sometimes "KEY\n<block>\n<entry>\n" — handle both.
            try:
                text = header.decode('utf-8', errors='replace')
            except Exception as e:
                print(f"  Entry {i}: could not decode header: {e}")
                continue
            lines = [ln for ln in text.split('\n') if ln.strip()]
            if not lines:
                print(f"  Entry {i}: no lines after split")
                continue
            key = lines[0].strip()
            print(f"  Entry {i}: key='{key}', header_lines={lines}")
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
                print(f"  Entry {i}: could not find pointer line in {lines[1:]}")
                continue

            block = get_block(block_num)
            if not block:
                print(f"  Entry {i}: empty block {block_num}")
                continue
            chunks = block.split(b'\x00')
            print(f"  Entry {i}: block {block_num} has {len(chunks)} chunks, entry_idx={entry_idx}")
            if entry_idx >= len(chunks):
                print(f"  Entry {i}: entry_idx {entry_idx} >= chunks {len(chunks)}")
                continue
            entry = chunks[entry_idx].decode('utf-8', errors='replace')
            results.append((key, entry))
            if len(results) < 3:  # Show first few results
                print(f"    -> result: ('{key}', '{entry[:50]}...')")
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
