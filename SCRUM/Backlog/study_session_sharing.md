---
title: "Share Study Session as Link"
status: backlog
priority: P2
project: bible-study-app
type: dev
agent_claimed: null
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T00:00:00Z'
tags: []
due: null
estimate: small
---

# Share Study Session as Link

## Summary
Generate a read-only shareable permalink for any study session — combining the passage, AI conversation summary, and user notes into a single shareable view accessible without login.

## Value Proposition
Notes, AI study conversations, and group sharing all exist after Sprint 7. A shareable link for a full study session closes the last gap in the social layer: users can share their study work with anyone, even outside the app, and post those links into group feeds.

## Context
- URL deep linking already implemented (existing feature in context.md)
- AI conversation history: `ai_conversation_history_persistence` (Sprint 2 bonus)
- Notes system: Sprint 1+
- Groups feed: Sprint 7
- Implementation: generate a UUID-based share token; store session snapshot (passage ref + note IDs + AI convo ID) in a `shared_sessions` table; render at `/share/:token` without auth

## Acceptance Criteria
- [ ] "Share" button on any study session (AI panel or notes panel) generates a read-only permalink
- [ ] Permalink renders the passage, AI conversation summary, and notes without requiring login
- [ ] Link can be copied to clipboard and posted to a group feed as a rich preview card
- [ ] Shared sessions expire after 90 days (configurable)

## Notes
P2: Small estimate because deep linking and notes storage are already built — this is primarily a share token model + a read-only view route. Completes the social loop started in Sprint 7.
