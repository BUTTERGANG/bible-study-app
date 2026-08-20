# Sprint View — bible-study-app

> **Sprint:** 2026-06
> **Sprint Name:** Reconciliation & Green Gates
> **Start:** 2026-06-09 | **End:** 2026-06-11
> **Goal:** Land the audit/fix work onto main: reconcile the divergent fix branch, reach green test/lint/build gates, linearize the Alembic migration chain, and sync docs.

---

## In Progress

| Task | Agent | Priority | Est. |
|------|-------|----------|------|
| —    | —     | —        | —    |

---

## Sprint Backlog

| Task File | Priority | Estimate | Status |
|-----------|----------|----------|--------|
| —         | —        | —        | sprint |

---

## Done This Sprint

| Task | Priority | Estimate | Completed |
|------|----------|----------|-----------|
| Reconcile `fix/audit-bugs-lint-docs` onto main (lemma NameError, SPA path-traversal, streaming crash, stale closure) | P0 | medium | 2026-06-11 |
| Backend ruff sweep to clean (`make lint` 283 → 0) | P0 | medium | 2026-06-11 |
| Frontend ESLint sweep to clean (`make frontend-lint` 0 warnings) | P0 | medium | 2026-06-11 |
| Fix `create_note` book validation (400 on unknown book; align with list) | P1 | small | 2026-06-11 |
| Linearize Alembic migrations (single head 0022; `upgrade head` was failing) | P1 | medium | 2026-06-11 |
| Verify all gates: pytest 160 passed, ruff clean, eslint/build clean | P0 | medium | 2026-06-11 |
| Sync docs (README, THE-VISION CURRENT-STATE/README/GAPS, SCRUM board) | P2 | medium | 2026-06-11 |

### Earlier in the sprint (pre-reconciliation)
| Task | Priority | Estimate | Completed |
|------|----------|----------|-----------|
| Original language courses + clause syntax search | P1 | large | 2026-06-09 |
| Group Discussion Threads | P1 | medium | 2026-06-09 |
| Backend API Test Suite | P1 | medium | 2026-06-09 |
| Share Study Session as Link | P2 | small | 2026-06-09 |
| Reading Streak & Badges | P2 | medium | 2026-06-09 |
| Community Tags | P2 | medium | 2026-06-09 |

---

## Blocked

| Task | Blocked Since | Reason |
|------|---------------|--------|
| —    | —             | —      |