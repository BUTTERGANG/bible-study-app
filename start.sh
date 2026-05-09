#!/bin/bash
set -e

VENV_SITE="/home/runner/workspace/.venv/lib/python3.11/site-packages"

# Provide libstdc++ from the Nix GCC runtime so C-extension packages
# (greenlet, pymupdf, etc.) can load. The system /lib version conflicts with
# Nix Python and causes a segfault; the Nix gcc-lib version is ABI-compatible.
NIX_STDCXX=$(for f in /nix/store/*-gcc-*-lib/lib/libstdc++.so.6; do
  file -L "$f" 2>/dev/null | grep -q "ELF 64-bit" && dirname "$f" && break
done)
export LD_LIBRARY_PATH="${NIX_STDCXX}:${LD_LIBRARY_PATH:-}"

# Install Python deps into project-local directory (Nix prevents system-wide installs)
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

export PYTHONPATH="$VENV_SITE:${PYTHONPATH:-}"

# Build frontend (skip if dist already exists to speed up restarts)
if [ ! -d "frontend/dist" ]; then
  echo "Building frontend..."
  cd frontend
  npm install --silent
  npm run build
  cd ..
fi

echo "Starting Bible Study backend..."
# Kill any process already holding the port (e.g. a stale dev server)
TARGET_PORT="${PORT:-5000}"
fuser -k "${TARGET_PORT}/tcp" 2>/dev/null || true

cd backend
exec python3 -m uvicorn main:app --host 0.0.0.0 --port "${TARGET_PORT}"
