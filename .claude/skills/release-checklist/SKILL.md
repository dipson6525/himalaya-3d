---
name: release-checklist
description: Pre-presentation checks before tagging v0.1-midterm or v1.0-final — tests green, Lighthouse, screenshots, docs, credits, disclaimer, tag. Use before the mid-term demo, the final presentation, or any release tag.
---

# Release checklist (mid-term `v0.1-midterm`, final `v1.0-final`)

Work through every box; write the evidence (command + short output) into `docs/PROGRESS.md`.

## Code & tests
- [ ] `main` CI run is green (`gh run list --branch main --limit 1`).
- [ ] In `app/`: `npm ci && npm run lint && npm run typecheck && npm test && npm run e2e` all pass.
- [ ] In `data-prep/`: `ruff check . && pytest` pass.
- [ ] No open `type:bug` issues in the milestone being released (or each one is noted as known).

## Live site
- [ ] Latest deploy succeeded and the live URL loads (use the deploy skill, step 5).
- [ ] Credits visible: Cesium, © OpenStreetMap contributors, USGS (if layer on), "Weather data by Open-Meteo.com" (if weather shown).
- [ ] "Not medical advice" disclaimer visible on every screen.
- [ ] Lighthouse run on the live URL saved to `docs/testing/` (the team runs it; do not invent scores).

## Evidence & docs
- [ ] Fresh screenshots in `docs/screenshots/` taken from the real app.
- [ ] README up to date (live link, setup, credits, team & roles).
- [ ] `docs/testing/` tables: result cells filled by the team or clearly marked as pending.
- [ ] `docs/OPEN_QUESTIONS.md` reviewed; every `TODO(team)` either resolved or listed.
- [ ] Viva notes refreshed for all three members; viva-examiner subagent run.
- [ ] `docs/AI_USAGE.md` updated.
- [ ] Mid-term only: `docs/midterm-demo.md` script rehearsed.

## Tag (only after a human says go)
- [ ] `git tag -a v0.1-midterm -m "Mid-term demo"` (or `v1.0-final`) on the green `main` commit.
- [ ] `git push origin <tag>` and create a GitHub release with notes from `docs/PROGRESS.md`.
