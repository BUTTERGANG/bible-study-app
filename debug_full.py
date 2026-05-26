import struct as st
import zlib
from pathlib import Path

def debug_zld(data_path: Path):
    idx_file = data_path.with_suffix('.idx')
    dat_file = data_path.with_suffix('.dat')
    zdx_file = data_path.with_suffix('.zdx')
    zdt_file = data_path.with_suffix('.zdt')

    print(f"Checking files in {data_path.parent}:")
    for f in [idx_file, dat_file, zdx_file, zdt_file]:
        print(f"  {f.name}: exists={f.exists()}, size={f.stat().st_size if f.exists() else 0}")

    with open(idx_file, 'rb') as f:
        idx_data = f.read()
    with open(dat_file, 'rb') as f:
        dat_data = f.read()
    with open(zdx_file, 'rb') as f:
        zdx_data = f.read()
    with open(zdt_file, 'rb') as f:
        zdt_data = f.read()

    print(f"\nSizes: idx={len(idx_data)}, dat={len(dat_data)}, zdx={len(zdx_data)}, zdt={len(zdt_data)}")

    # Parse zdx blocks
    num_blocks = len(zdx_data) // 12
    print(f"Number of zdx blocks: {num_blocks}")
    block_meta = []
    for i in range(num_blocks):
        off, comp_sz, uncomp_sz = st.unpack_from('<III', zdx_data, i * 12)
        block_meta.append((off, comp_sz, uncomp_sz))
        if i < 5:
            print(f"  Block {i}: offset={off} (0x{off:x}), comp_size={comp_sz}, uncomp_size={uncomp_sz}")

    # Decompress each block and see what we get
    print("\nDecompressing blocks:")
    for i in range(min(5, num_blocks)):
        off, comp_sz, uncomp_sz = block_meta[i]
        try:
            out = zlib.decompress(zdt_data[off:off + comp_sz])
            print(f"  Block {i}: requested decompress {comp_sz} -> got {len(out)} (expected {uncomp_sz})")
            if len(out) != uncomp_sz:
                print(f"    WARNING: decompressed size mismatch!")
            # Show first 100 bytes as text
            if len(out) > 0:
                print(f"    First 100 bytes: {out[:100]}")
        except Exception as e:
            print(f"  Block {i}: ERROR - {e}")

    # Now parse the .idx and .dat to see what pointers we get
    print("\nParsing .idx and .dat:")
    num_entries = len(idx_data) // 8
    print(f"Number of entries in .idx: {num_entries}")
    for i in range(min(10, num_entries)):
        dat_off, dat_len = st.unpack_from('<II', idx_data, i * 8)
        header = dat_data[dat_off:dat_off + dat_len]
        try:
            text = header.decode('utf-8', errors='replace')
        except:
            text = str(header)
        print(f"  Entry {i}: dat_off={dat_off}, dat_len={dat_len}")
        print(f"    Header bytes: {header.hex()}")
        print(f"    Header text: {repr(text)}")
        # Parse the header
        lines = [ln for ln in text.split('\n') if ln.strip()]
        if not lines:
            print(f"    No lines")
            continue
        key = lines[0].strip()
        print(f"    Key: {repr(key)}")
        # Find pointer
        block_num = entry_idx = None
        for ln in lines[1:]:
            parts = ln.strip().split(':')
            if len(parts) >= 2 and all(p.strip().isdigit() for p in parts[:2]):
                block_num = int(parts[0])
                entry_idx = int(parts[1])
                break
        if block_num is None:
            print(f"    No pointer found in lines {lines[1:]}")
            continue
        print(f"    Pointer: block={block_num}, entry_idx={entry_idx}")
        if block_num >= num_blocks:
            print(f"    ERROR: block_num {block_num} >= num_blocks {num_blocks}")
            continue
        block = zlib.decompress(zdt_data[block_meta[block_num][0]:block_meta[block_num][0] + block_meta[block_num][1]])
        chunks = block.split(b'\x00')
        print(f"    Block {block_num} decompressed to {len(block)} bytes, split into {len(chunks)} chunks")
        if entry_idx >= len(chunks):
            print(f"    ERROR: entry_idx {entry_idx} >= chunks {len(chunks)}")
            continue
        entry = chunks[entry_idx].decode('utf-8', errors='replace')
        print(f"    Entry text: {repr(entry[:50])}")

if __name__ == '__main__':
    data_path = Path('data/sword_extracted/Easton/modules/lexdict/zld/easton/easton')
    debug_zld(data_path)
