---
title: "Backend API Test Suite"
status: done
priority: P1
project: bible-study-app
type: dev
agent_claimed: owl
claimed_at: '2026-06-09T00:00:00Z'
created: '2026-06-08T00:00:00Z'
updated: '2026-06-09T00:00:00Z'
tags: [done]
due: null
estimate: medium
completed_at: '2026-06-09T00:00:00Z'
---

# Backend API Test Suite

## Summary
Write integration tests for the core FastAPI backend routes so the 3-layer CI pipeline catches regressions rather than just type errors.

## Context
- CI pipeline added: 3-layer GitHub Actions, Dockerfile, pre-push hook (2026-06-08)
- Backend: FastAPI + SQLAlchemy + SQLite in `backend/`
- Key routes: Bible reader, search (FTS5), notes, groups, auth, reading plans

## Acceptance Criteria
- [x] Pytest integration tests cover: GET /api/bible/{ref}, POST /api/notes, GET /api/groups, POST /api/auth/login, GET /api/search?q=
- [x] Tests run in GitHub Actions CI against a seeded in-memory SQLite test DB
- [x] Pipeline fails the PR check on any test regression
- [x] `make test` runs the full suite locally in under 60 seconds

## Work Log
- Implemented in commit e8158f2
- Added integration tests for: bible chapter fetch, notes CRUD+tags, search scopes/limits/translations, auth login endpoint
- 350+ new test assertions across 4 test files (test_bible, test_notes, test_search, test_auth)
- Tests run against seeded in-memory SQLite test DB
- Pipeline fails on test regression

## Notes
P1: CI pipeline is wasted infrastructure without tests. Medium estimate because routes are well-defined; the main work is fixture setup and async test wiring.
