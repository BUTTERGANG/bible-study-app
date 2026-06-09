---
title: "Reading Streak & Badges"
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
estimate: medium
completed_at: '2026-06-09T00:00:00Z'
---

# Reading Streak & Badges

## Summary
Track daily reading plan completion to display current streak, longest streak, and milestone badges on the dashboard.

## Context
- Reading plans implemented: Sprint 2
- Dashboard implemented: Sprint 4
- Social sharing cards: Sprint 4

## Acceptance Criteria
- [x] Track consecutive days a user completes at least one reading plan segment
- [x] Dashboard shows: current streak (days), longest streak ever, last milestone badge earned
- [x] Milestone badges: 7 days, 30 days, 100 days, 365 days
- [x] Streak resets at midnight (user's local timezone) if no completion that calendar day
- [x] Share streak as a social card (reuses existing social sharing component from Sprint 4)

## Work Log
- Implemented in commit e8158f2
- ReadingStreak + StreakBadge models
- /api/streaks endpoints: GET streak, POST record, GET share
- Milestone badges (7, 30, 100, 365 days) with emoji
- StreakWidget.jsx frontend component
- Alembic migration 0013

## Notes
P2: High retention value, low implementation cost since all prerequisite data already exists.
