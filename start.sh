#!/bin/bash
set -e

# Always run from the workspace root (the directory containing this script).
cd "$(dirname "$0")"

VENV_SITE="/home/runner/workspace/.venv/lib/python3.11/site-packages"

# Provide libstdc++ from the Nix GCC runtime so C-extension packages
# (greenlet, pymupdf, etc.) can load. The system /lib version conflicts with
# Nix Python and causes a segfault; the Nix gcc-lib version is ABI-compatible.
# Prefer gcc-13+ (provides GLIBCXX_3.4.32 needed by Node.js 20); fall back to
# any native 64-bit gcc lib so Python C extensions still load.
NIX_STDCXX=$(for f in \
  /nix/store/*-gcc-1[3-9]*-lib/lib/libstdc++.so.6 \
  /nix/store/*-gcc-[2-9][0-9]*-lib/lib/libstdc++.so.6 \
  /nix/store/*-gcc-*-lib/lib/libstdc++.so.6; do
  [[ "$f" =~ (aarch64|riscv|mingw|musl|avr) ]] && continue
  file -L "$f" 2>/dev/null | grep -q "ELF 64-bit" && dirname "$f" && break
done)
export LD_LIBRARY_PATH="${NIX_STDCXX}:${LD_LIBRARY_PATH:-}"

# Install Python deps into project-local directory (Nix prevents system-wide installs).
# Skip install if every required package is importable — keeps cold-restart fast.
echo "Checking Python dependencies..."
export PYTHONPATH="$VENV_SITE:${PYTHONPATH:-}"
if ! python3 -c "import fastapi, sqlalchemy, anthropic, aiosqlite, dotenv, jose, passlib" 2>/dev/null; then
  echo "Installing Python dependencies..."
  pip3 install -r requirements.txt \
      --target "$VENV_SITE" \
      --upgrade \
      --quiet \
      --break-system-packages 2>/dev/null || \
    pip3 install -r requirements.txt \
      --target "$VENV_SITE" \
      --quiet \
      --break-system-packages
fi

# Build frontend if dist is missing or any source file is newer than the build
NEEDS_BUILD=false
if [ ! -d "frontend/dist" ]; then
  NEEDS_BUILD=true
elif [ -n "$(find frontend/src frontend/public frontend/index.html frontend/vite.config.js frontend/tailwind.config.js -newer frontend/dist/index.html 2>/dev/null | head -1)" ]; then
  NEEDS_BUILD=true
fi

if [ "$NEEDS_BUILD" = true ]; then
  echo "Building frontend..."
  cd frontend
  npm install --silent
  npm run build
  cd ..
else
  echo "Frontend dist is up to date, skipping build."
fi

echo "Starting Bible Study backend..."
# Kill any process already holding the port (e.g. a stale dev server).
# fuser / lsof are not available in the Nix sandbox, so we use /proc/net/tcp
# to find the PID and send SIGTERM, then wait briefly for the port to free.
TARGET_PORT="${PORT:-8000}"
python3 - <<EOF
import os, signal, time

port_hex = format($TARGET_PORT, '04X')
try:
    with open('/proc/net/tcp') as f:
        for line in f:
            parts = line.split()
            if len(parts) < 10:
                continue
            local_addr = parts[1]
            state = parts[3]
            inode = parts[9]
            if local_addr.endswith(':' + port_hex) and state == '0A':  # LISTEN
                # Find PID owning this inode
                for pid in os.listdir('/proc'):
                    if not pid.isdigit():
                        continue
                    try:
                        fds = os.listdir(f'/proc/{pid}/fd')
                        for fd in fds:
                            try:
                                link = os.readlink(f'/proc/{pid}/fd/{fd}')
                                if f'socket:[{inode}]' == link:
                                    os.kill(int(pid), signal.SIGTERM)
                                    time.sleep(1)
                                    raise StopIteration
                            except (OSError, PermissionError):
                                pass
                    except (OSError, PermissionError):
                        pass
except StopIteration:
    pass
except Exception:
    pass
EOF

# Launch the package — no `cd backend` hack required.
exec python3 -m uvicorn backend.main:app --host 0.0.0.0 --port "${TARGET_PORT}"
