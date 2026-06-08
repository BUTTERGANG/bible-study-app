---
title: "Clause Syntax Search"
status: backlog
priority: P3
project: bible-study-app
type: dev
agent_claimed: null
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T00:00:00Z'
tags: []
due: null
estimate: large
---

# Clause Syntax Search

## Summary
Sentence and clause-level biblical search using OpenText.org syntactic annotations — let users find verses by grammatical structure rather than just word presence (e.g. "imperative verb + direct address in Paul's letters").

## Value Proposition
Logos's OpenText.org clause search is one of its most differentiating scholarly features. Morphological search (Sprint 1) handles word-level queries; clause syntax search operates at the sentence structure level — enabling research queries no other consumer Bible app supports.

## Context
- Icebox item promoted: `01_Icebox/bible-study-app/clause_syntax_search.md`
- Morphological search: Sprint 1
- Data source: OpenText.org Syntactic Greek NT (available as XML/JSON under CC license)
- Ingest pipeline would parse clause-level annotations into a new `clause_syntax` table
- Backend: new `/api/syntax/search` endpoint with clause property filters
- Frontend: advanced search modal with clause filter dropdowns

## Acceptance Criteria
- [ ] Ingest OpenText.org clause-level syntactic annotations for the GNT into `clause_syntax` table
- [ ] Search by verb mood/tense/voice and clause role (subject, predicate, complement, adjunct)
- [ ] Filter results by book, testament, or Pauline/non-Pauline author
- [ ] Results highlight the matching clause within the verse display
- [ ] Combine with morphological search for compound word+clause queries

## Notes
P3: Large estimate. **Blocked until OpenText.org data format is confirmed accessible.** Verify data availability before starting — if the annotation XML isn't freely downloadable, descope to a simpler clause-keyword approach using existing FTS5.
