---
title: "Reading Streak & Badges"
status: done
priority: P2
project: bible-study-app
type: dev
agent_claimed: agent-03
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T12:00:00Z'
tags: []
due: null
estimate: medium
---

# Reading Streak & Badges

## Summary
Track daily reading plan completion to display current streak, longest streak, and milestone badges on the dashboard — motivating consistent daily engagement.

## Value Proposition
Reading plans (M'Cheyne, NT-90, etc.) and the dashboard both exist from Sprints 2 and 4. Streak tracking is the standard retention mechanic in Bible apps (YouVersion, Bible.is) and costs very little to implement on top of the existing reading plan progress data model.

## Context
- Reading plans implemented: `build_reading_plan_ui_panel` (Sprint 2)
- Dashboard implemented: `mobile_dashboard` (Sprint 4)
- Social sharing cards: Sprint 4 — streak card can reuse the same export component
- Reading plan progress stored per-user in `user_reading_plan_progress` or equivalent table
- New column or table needed: `streak_data` (user_id, current_streak, longest_streak, last_completed_date)

## Acceptance Criteria
- [ ] Track consecutive days a user completes at least one reading plan segment
- [ ] Dashboard shows: current streak (days), longest streak ever, last milestone badge earned
- [ ] Milestone badges: 7 days, 30 days, 100 days, 365 days
- [ ] Streak resets at midnight (user's local timezone) if no completion that calendar day
- [ ] Share streak as a social card (reuses existing social sharing component from Sprint 4)

## Notes
P2: High retention value, low implementation cost since all prerequisite data already exists. Medium estimate for the streak calculation logic + badge UI.
