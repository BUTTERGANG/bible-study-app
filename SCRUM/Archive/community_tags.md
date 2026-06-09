---
title: "Community Tags"
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

# Community Tags

## Summary
Let users tag passages and resources with custom labels and surface aggregated community tags.

## Context
- Multi-user auth and data isolation landed in Sprint 7
- Tags attach to passage (book/chapter/verse range) or resource_id (library item)

## Acceptance Criteria
- [x] Users can add freeform tags to any passage or library resource
- [x] Community tag cloud shows aggregate frequency per passage (top 5 visible, expand to see all)
- [x] Browse/filter content by tag across the app (tag search page)
- [x] Upvote tags; top-voted tags render first; own tags highlighted

## Work Log
- Implemented in commit e8158f2
- PassageTag + TagUpvote models
- /api/tags endpoints: CRUD, tag cloud, upvote, search by tag
- CommunityTagsPanel.jsx with tag cloud rendering + search
- Alembic migration 0013

## Notes
P2: Unblocked by Sprint 7 multi-user work. Medium estimate.
