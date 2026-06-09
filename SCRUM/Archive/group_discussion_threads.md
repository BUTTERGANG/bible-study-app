---
title: "Group Discussion Threads"
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

# Group Discussion Threads

## Summary
Add threaded discussion to the Groups system so members can reply to group notes and create multi-turn conversations around shared passages and study content.

## Context
- Groups system landed in `feat: Groups & Collaboration system for LOGOS PWA` (2026-05-29)
- Group notes and feed already exist; this extends the data model with threading via parent_id
- Push notification infrastructure from Sprint 6 can trigger reply notifications
- Backend: `backend/routers/groups.py` (FastAPI)
- Frontend: group feed components in `frontend/src/`

## Acceptance Criteria
- [x] Any group member can reply to a group note, creating a thread
- [x] Threads render in the group feed in collapsed/expanded form
- [x] New replies trigger an in-app notification using the existing push notification system
- [x] Thread author can delete their own posts; group admin can delete any post

## Work Log
- Implemented in commit e8158f2
- parent_id on GroupNote model for self-referential threading
- Threaded list endpoint (?threaded=true), reply endpoint
- In-app reply notifications (graceful fallback if InAppNotification missing)
- ThreadReplies.jsx frontend component
- Alembic migration 0011

## Notes
P1 because groups shipped in Sprint 7 and this is the immediate follow-on that makes the feature sticky. No external dependencies.
