---
title: "Backend API Test Suite"
status: backlog
priority: P1
project: bible-study-app
type: dev
agent_claimed: null
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T00:00:00Z'
tags: []
due: null
estimate: medium
---

# Backend API Test Suite

## Summary
Write integration tests for the core FastAPI backend routes so the newly-added 3-layer CI pipeline (GitHub Actions, Dockerfile, pre-push hook) catches regressions rather than just type errors.

## Value Proposition
The CI pipeline added June 8 is structure without substance until real tests run inside it. Integration tests against a seeded SQLite test DB give every agent commit a meaningful safety net — especially important now that the codebase has groups, auth, notes, and reading plans all interacting.

## Context
- CI pipeline added: `Add 3-layer CI pipeline: GitHub Actions, Dockerfile, pre-push hook` (2026-06-08)
- Backend: FastAPI + SQLAlchemy + SQLite in `backend/`
- Key routes: Bible reader, search (FTS5), notes, groups, auth, reading plans
- Use `pytest` + `httpx.AsyncClient` (FastAPI's recommended test client)
- Test DB: in-memory SQLite populated with a seed fixture (small canonical Bible sample)

## Acceptance Criteria
- [ ] Pytest integration tests cover: GET /api/bible/{ref}, POST /api/notes, GET /api/groups, POST /api/auth/login, GET /api/search?q=
- [ ] Tests run in GitHub Actions CI against a seeded in-memory SQLite test DB
- [ ] Pipeline fails the PR check on any test regression
- [ ] `make test` runs the full suite locally in under 60 seconds

## Notes
P1: CI pipeline is wasted infrastructure without tests. Medium estimate because routes are well-defined; the main work is fixture setup and async test wiring.
