# Progress log

Newest first. Each entry: date, milestone, what was done, PRs/issues, test evidence, screenshots,
what the TEAM must do next, open questions.

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
