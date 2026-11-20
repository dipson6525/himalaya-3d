# Progress log

Newest first. Each entry: date, milestone, what was done, PRs/issues, test evidence, screenshots,
what the TEAM must do next, open questions.

---

## 2026-11-20 · M1 #6 Route data schema + validator (owner: Unique)

**Done (for Unique to review)**

- `docs/data-schema.md`: one FeatureCollection per route; one `route` LineString + one `stop`
  Point per overnight stop; positions only in geometry; nights derived from `day`; every altitude
  cites a Source ID; `TODO` values rejected (ADR-017).
- `data-prep/prep/schema.py`: plain-Python validator returning every error; `python -m prep.schema`
  checks all files in `data/routes/`.
- `data-prep/tests/test_schema.py`: one test per rule with synthetic data, plus a test that runs on
  every real route file (skipped while `data/routes/` has none).
- `app/src/features/routes/types.ts`: matching TypeScript types for M3.
- Viva notes (Unique): validator walkthrough, worked examples, questions 7–14, exercises 5–7.

**Test evidence (local, Windows)**

```
data-prep> ruff check .       → All checks passed!
data-prep> pytest -q          → 46 passed, 1 skipped (the real-files test: no route files yet)
data-prep> python -m prep.schema → No .geojson files in data/routes yet.
app> npm run lint / typecheck / test → clean · clean · 3 passed
```

**TEAM TODO:** Unique reviews and merges the PR; confirm the 4th route (Q6) before #12.

---

## 2026-11-20 · M0 follow-up: contributors list

**Done**

- PR #36 (M0 scaffolding) merged after CI passed (web: lint, typecheck, 3 Vitest tests, build,
  Playwright 1 passed on Ubuntu with SwiftShader; data-prep: ruff, 3 pytest). Deploy workflow ran
  after CI and succeeded. Issues #1–#5 closed.
- New commits and PRs carry no Claude attribution (ADR-016): `.claude/settings.json` turns off the
  co-author trailer and PR footer, and this repo's git email typo is fixed so commits are credited
  to the GitHub account. The team chose not to rewrite `main`, so the first 8 M0 commits keep their
  trailers and Claude stays in the contributor list for those.

**TEAM TODO**

1. `gh secret set CESIUM_ION_TOKEN` — the live site still uses the offline globe without it. (Q2)
2. Fix the laptop's global git name and email (Q10).
3. Teammates' GitHub usernames (Q1); confirm FRs/NFRs against the proposal PDF (Q4).

---

## 2026-11-19 · M0 Requirements & setup

**Done (by Claude Code, for team review)**

- Environment: Git 2.56, gh logged in as `dipson6525` (scopes: repo, workflow, gist, read:org —
  no `project`), Node 26.13.1 / npm 11.20.0, Python 3.12.10 via the `py` launcher (`python` is
  the Windows Store alias), GDAL not installed (not needed, ADR-006). `.env.local` exists in the
  project root (not opened).
- GitHub: public repo `dipson6525/himalaya-3d`, 15 labels, 9 milestones (M0–M8), issues #1–#35.
  No Project board (token lacks `project` scope). GitHub Pages enabled (source: GitHub Actions).
- App scaffold (#1): React 19.3 + Vite 8.3 + TypeScript 6.0 strict + CesiumJS 1.147; `envDir` =
  project root; production base `/himalaya-3d/`; Cesium static files copied to `<base>cesium/`;
  offline imagery fallback without a token; tiny i18n helper with en/ne parity test; layout with
  always-visible medical disclaimer.
- Data-prep scaffold (#1): venv, pinned gpxpy/shapely/pyproj/requests/pytest/ruff, shared paths,
  committed cache folder policy, `route-sources.md` citation template.
- CI + deploy workflows (#2); requirements FR1–FR9 + NFRs (#3); architecture with Mermaid (#4);
  Claude skills, subagents, Playwright MCP, AI usage disclosure (#5).
- Docs: decisions ADR-001–013, open questions, glossary, i18n review list, viva notes for all
  three members (M0 scope), plan for M0–M2 (`docs/plans/m0-m2-plan.md`).

- Code review (code-reviewer subagent) before the PR. Fixed: Node `engines` range (CesiumJS needs
  ≥ 22.17; Vitest/static-copy skip Node 23/25), deploy now waits for green CI on main (ADR-014),
  credits test uses `toBeVisible`, screenshots only written with `UPDATE_SCREENSHOTS=1` (ADR-015),
  Playwright MCP pinned to 0.0.86, wording about the duplicated `cesium` folder name corrected.

**PR:** `team/m0-scaffold` → main (M0 scaffolding; may be merged once CI is green).

**Test evidence (local, Windows, 2026-11-19)**

```
app> npm run lint        → ESLint clean; "All matched files use Prettier code style!"
app> npm run typecheck   → no errors (tsconfig.json + tsconfig.node.json)
app> npm test            → Test Files 1 passed (1) · Tests 3 passed (3)
app> npm run e2e         → 1 passed — "app shell loads with globe, credits and medical disclaimer"
                           (also passed with the token blanked: offline fallback path)
data-prep> ruff check .  → All checks passed!
data-prep> pytest        → 3 passed
```

**Screenshot:** `docs/screenshots/m0-app-shell.png` (local build with token).

**TEAM TODO**

1. Set the deploy secret: `gh secret set CESIUM_ION_TOKEN` (paste the token when prompted). (Q2)
2. After the first deploy with the token: on ion.cesium.com restrict that token's Allowed URLs to
   `https://dipson6525.github.io/himalaya-3d/`. (Q3)
3. Send the other members' GitHub usernames so they can be invited. (Q1)
4. Confirm FR numbering vs proposal (Q4), semester week 1 date (Q5), 4th route (Q6).
5. Each member: read your `docs/viva/<name>.md` and do the "prove you understand it" exercises by hand.
6. Fix this laptop's global git `user.name` (Q10).

**Open questions:** see `docs/OPEN_QUESTIONS.md` (Q1–Q11).
