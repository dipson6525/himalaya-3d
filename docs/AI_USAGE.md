# AI usage disclosure

This project was developed with help from **Claude Code** (Anthropic), an AI coding assistant
that ran on a team member's laptop with access only to this project folder.

## What the AI did

| Date | Milestone | What Claude Code did | How the team checks it |
| --- | --- | --- | --- |
| 2026-11-19 | M0 | Checked the environment; created the GitHub repo, labels, milestones and the issue backlog; scaffolded the React + Vite + TypeScript + CesiumJS app, the Python data-prep project, CI and deploy workflows; wrote the first versions of requirements, architecture, decisions and viva notes; set up Claude Code skills and subagents. | Each member reads the files they own (see CLAUDE.md), runs the checks locally, and completes the "prove you understand it" exercises in their viva notes by hand. |
| 2026-11-20 | M0 / M1 | Turned off AI co-author lines (ADR-016). For issue #6, drafted the route schema doc, the Python validator and its tests, the TypeScript types and Unique's notes. A code-reviewer subagent found 2 crashes and 1 missing rule, which were fixed; a viva-examiner subagent found wrong statements in the notes, which were corrected. | Unique reviews and merges PR #38, runs the tests, and does exercises 5–7 in `docs/viva/unique-ghimire.md` by hand. |
| 2026-11-20 | M1 | For issue #7, drafted `docs/ui-design.md` (component tree, shared state, wireframes), ADR-018 and the UI-design part of Dipson's notes; generated the text wireframes with a script so the boxes line up. A viva-examiner subagent checked the notes. | Dipson reviews and merges the PR, checks the design against the real app as features land, and does the new exercises in `docs/viva/dipson-gurung.md` by hand. |
| 2026-11-21 | M2 | For issue #8, drafted the Overpass cache module, the route builder, the spec template, their tests (synthetic data, no network), ADR-019 and the pipeline part of Unique's notes. A code-reviewer subagent found closed loops and far-away stops being accepted, crashes on bad input and one test that could reach the network; all fixed with tests. Made no real Overpass request. | Unique reviews and merges the PR, makes the first real query in #9, and does exercises 8–10 by hand. |

## Rules we gave the AI (from CLAUDE.md and our setup prompt)

- Never invent data, altitudes, test results, FPS numbers, load times or user feedback;
  unknowns are marked `TODO(team): verify` and listed in `docs/OPEN_QUESTIONS.md`.
- Never read or commit secrets (the Cesium token).
- Write code a second-year student can explain, with header and doc comments.
- Feature pull requests are reviewed and merged by the student who owns the area, not by the AI.

## What the AI did NOT do

- It did not collect user-testing results, FPS or load-time measurements — the team does these
  on real laptops and records real numbers in `docs/testing/`.
- It did not review the Nepali translations as a native speaker (see `docs/i18n-review.md`).
- It did not decide medical guidance; the acclimatization rules follow the cited Wilderness
  Medical Society guidelines and are labelled "not medical advice".

## Commit metadata

From 2026-11-20, commits and pull requests carry no AI co-author lines (ADR-016). The first 8 M0
commits (2026-11-19) still do, so GitHub lists Claude as a contributor for those. This file is
where AI assistance is disclosed.

## How we verify AI-written work

1. CI runs lint, typecheck, unit tests, a production build, Playwright e2e, ruff and pytest on
   every pull request.
2. The owning student reviews each feature PR line by line before merging.
3. The `code-reviewer` subagent reviews diffs; the `viva-examiner` subagent checks that each
   student's notes answer likely viva questions.
4. Each student completes hands-on exercises in `docs/viva/<name>.md` without AI help.
