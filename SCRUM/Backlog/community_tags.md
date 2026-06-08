---
title: "Community Tags"
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

# Community Tags

## Summary
Let users tag passages and resources with custom labels and surface aggregated community tags — showing what other users have tagged a passage with, ranked by upvotes.

## Value Proposition
This was blocked on multi-user infrastructure that shipped in Sprint 7. Now that individual user accounts, data isolation, and groups exist, community tags are the social discovery layer — they help users find patterns in how the community annotates Scripture.

## Context
- Icebox item promoted: `01_Icebox/bible-study-app/community_tags.md`
- Multi-user auth and data isolation landed in Sprint 7
- Tags attach to `passage` (book/chapter/verse range) or `resource_id` (library item)
- New table: `passage_tags` (user_id, passage_ref, tag_text, upvotes)
- Frontend: add tag chip UI to PassageView and Library panels

## Acceptance Criteria
- [ ] Users can add freeform tags to any passage or library resource
- [ ] Community tag cloud shows aggregate frequency per passage (top 5 visible, expand to see all)
- [ ] Browse/filter content by tag across the app (tag search page)
- [ ] Upvote tags; top-voted tags render first; own tags highlighted

## Notes
P2: Unblocked by Sprint 7 multi-user work. Medium estimate — primarily DB schema + tag input/display UI. No AI calls needed.
