#!/usr/bin/env bash
# pre-push.sh — Run fast local checks before pushing to avoid CI failures.
# Usage: ./scripts/pre-push.sh
#        or add to .git/hooks/pre-push for automatic gating

set -euo pipefail
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILURES=0

# --- Backend lint ---
echo -e "${YELLOW}[1/4]${NC} Ruff lint..."
if python3 -m ruff check backend ingest 2>&1; then
  echo -e "${GREEN}  ✓ Ruff clean${NC}"
else
  echo -e "${RED}  ✗ Ruff found issues${NC}"
  ((FAILURES++))
fi

# --- Backend tests ---
echo -e "${YELLOW}[2/4]${NC} Pytest..."
export APP_PASSWORD=""
export JWT_SECRET_KEY="test-secret-do-not-use-in-prod-min-32-chars-long"
if python3 -m pytest backend/tests -q 2>&1; then
  echo -e "${GREEN}  ✓ Tests pass${NC}"
else
  echo -e "${RED}  ✗ Tests failed${NC}"
  ((FAILURES++))
fi

# --- Frontend build ---
echo -e "${YELLOW}[3/4]${NC} Vite build..."
if (cd frontend && npm run build 2>&1); then
  if [ -f frontend/dist/index.html ]; then
    echo -e "${GREEN}  ✓ Frontend builds${NC}"
  else
    echo -e "${RED}  ✗ dist/index.html missing after build${NC}"
    ((FAILURES++))
  fi
else
  echo -e "${RED}  ✗ Vite build failed${NC}"
  ((FAILURES++))
fi

# --- Frontend lint ---
echo -e "${YELLOW}[4/4]${NC} ESLint..."
if (cd frontend && npm run lint 2>&1); then
  echo -e "${GREEN}  ✓ ESLint clean${NC}"
else
  echo -e "${RED}  ✗ ESLint found issues${NC}"
  ((FAILURES++))
fi

# --- Summary ---
echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}All checks passed. Safe to push!${NC}"
  exit 0
else
  echo -e "${RED}$FAILURES check(s) failed.${NC}"
  read -rp "Push anyway? [y/N] " CONFIRM
  if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Pushing with failures...${NC}"
    exit 0
  else
    echo "Push aborted."
    exit 1
  fi
fi
