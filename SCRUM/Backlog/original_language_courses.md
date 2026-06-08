---
title: "Original Language Courses"
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

# Original Language Courses

## Summary
Build a structured Greek and Hebrew learning curriculum into the app — units, lessons, paradigm tables, and exercises — so learners can go from zero to reading the NT/OT without leaving the app.

## Value Proposition
Logos bundles Mounce's Greek and Pratico/Van Pelt's Hebrew as complete learning environments. Greek/Hebrew vocabulary drills shipped in Sprint 7; a full course structure is the next layer that turns isolated drills into a guided learning path — a major competitive differentiator.

## Context
- Icebox item promoted: `01_Icebox/bible-study-app/original_language_courses.md`
- Greek/Hebrew vocab drills: `greek_hebrew_vocab_drills` (Sprint 7 bonus)
- Interlinear reader: Sprint 1 (provides in-context reading practice)
- Course data: can be authored as JSON fixtures (units/lessons/exercises) committed to `data/courses/`
- New tables: `courses`, `course_lessons`, `lesson_exercises`, `user_course_progress`

## Acceptance Criteria
- [ ] Course structure: units → lessons → exercises for both Greek and Hebrew tracks
- [ ] Each lesson includes instruction text, paradigm tables, and vocabulary exercises drawn from the existing vocab drill system
- [ ] User progress stored per-user: % complete per unit, current lesson, current streak
- [ ] Course index accessible from main nav; continues from last lesson on return
- [ ] At least Unit 1 of Greek (alphabet + pronunciation) and Unit 1 of Hebrew (alphabet + vowels) authored as seed content

## Notes
P3: Large estimate — course data authoring + DB schema + multi-screen UI. Recommend scoping Sprint 8 to Unit 1 content + infrastructure; expand content in future sprints.
