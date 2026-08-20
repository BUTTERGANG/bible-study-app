---
status: backlog
priority: P2
agent_claimed: null
claimed_at: null
updated: 2026-08-20
---

# Verse Search and Cross-Reference

> **Repo:** bible-study-app
> **Description:** Full Bible text search with cross-reference navigation

---

## Context

Users need to search the full Bible text quickly and navigate cross-references between verses.

---

## Acceptance Criteria

- [ ] Full-text search across all books with autocomplete and fuzzy matching
- [ ] Cross-reference display (verse links, treasury of scripture knowledge)
- [ ] Book/chapter/verse navigation with jump-to functionality
- [ ] Highlighting and bookmarking with color-coded categories

---

## Technical Notes

- SQLite FTS5 for full-text search; Bible text dataset (KJV/ASV/NASB); verse normalization reference
