---
title: "Group Discussion Threads"
status: sprint
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

# Group Discussion Threads

## Summary
Add threaded discussion to the Groups system so members can reply to group notes and create multi-turn conversations around shared passages and study content.

## Value Proposition
Groups shipped notes in Sprint 7 but reading notes alone doesn't create engagement. Threaded replies turn a broadcast feed into an actual collaborative study space — the core value of group Bible study.

## Context
- Groups system landed in `feat: Groups & Collaboration system for LOGOS PWA` (2026-05-29)
- Group notes and feed already exist; this extends the data model with a `group_thread_replies` table
- Push notification infrastructure from Sprint 6 can trigger reply notifications
- Backend: `backend/routers/groups.py` (FastAPI)
- Frontend: group feed components in `frontend/src/`

## Acceptance Criteria
- [ ] Any group member can reply to a group note, creating a thread
- [ ] Threads render in the group feed in collapsed/expanded form
- [ ] New replies trigger an in-app notification using the existing push notification system
- [ ] Thread author can delete their own posts; group admin can delete any post

## Notes
P1 because groups shipped in Sprint 7 and this is the immediate follow-on that makes the feature sticky. No external dependencies.
