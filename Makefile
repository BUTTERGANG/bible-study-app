.PHONY: help dev test lint lint-fix migrate frontend-build frontend-lint

VENV := .venv/lib/python3.11/site-packages
PY := PYTHONPATH=$(VENV) python3

# Provide libstdc++ from the Nix GCC runtime for C-extension packages.
NIX_LIB := $(shell for f in /nix/store/*-gcc-*-lib/lib/libstdc++.so.6; do file -L $$f 2>/dev/null | grep -q "ELF 64-bit" && dirname $$f && break; done)
export LD_LIBRARY_PATH := $(NIX_LIB):$(LD_LIBRARY_PATH)

help:
	@echo "make dev             — launch the backend (start.sh)"
	@echo "make test            — run pytest"
	@echo "make lint            — run ruff"
	@echo "make lint-fix        — run ruff --fix"
	@echo "make migrate         — apply alembic migrations"
	@echo "make frontend-build  — vite build"
	@echo "make frontend-lint   — eslint src"

dev:
	bash start.sh

test:
	$(PY) -m pytest backend/tests

lint:
	$(PY) -m ruff check backend ingest

lint-fix:
	$(PY) -m ruff check --fix backend ingest

migrate:
	$(PY) -m alembic upgrade head

frontend-build:
	cd frontend && npm install --silent && npm run build

frontend-lint:
	cd frontend && npm run lint
