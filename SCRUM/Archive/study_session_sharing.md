---
title: "Share Study Session as Link"
status: done
priority: P2
project: bible-study-app
type: dev
agent_claimed: owl
claimed_at: '2026-06-09T00:00:00Z'
created: '2026-06-08T00:00:00Z'
updated: '2026-06-09T00:00:00Z'
tags: [done]
due: null
estimate: small
completed_at: '2026-06-09T00:00:00Z'
---

# Share Study Session as Link

## Summary
Generate a read-only shareable permalink for any study session.

## Context
- URL deep linking already implemented
- AI conversation history: Sprint 2 bonus
- Notes system: Sprint 1+
- Groups feed: Sprint 7

## Acceptance Criteria
- [x] "Share" button on any study session generates a read-only permalink
- [x] Permalink renders the passage, AI conversation summary, and notes without requiring login
- [x] Link can be copied to clipboard and posted to a group feed as a rich preview card
- [x] Shared sessions expire after 90 days (configurable)

## Work Log
- Implemented in commit e8158f2
- SharedSession model + /api/shares endpoints (POST create, GET public resolve)
- UUID4 share tokens with 90-day expiry, view counting
- ShareButton + SharePage frontend components
- Alembic migration 0012

## Notes
P2: Small estimate — primarily a share token model + read-only view route.
