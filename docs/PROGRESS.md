# Progress log

Newest first. Each entry: date, milestone, what was done, PRs/issues, test evidence, screenshots,
what the TEAM must do next, open questions.

---

## 2026-11-22 · M4 #19 Flythrough camera (owner: Sparsh)

**Done**

- PR #52 (#49 daily stages) merged after green CI and code-review fixes (ADR-021).
- `engine/flythrough/path.ts`: equal-interval resampling, safe flight heights from sampled
  terrain, Cesium Catmull-Rom spline in ECEF, a distance lookup table for the curve (constant
  ground speed, also around corners), camera pose behind/above/looking ahead, exponential
  heading smoothing (ADR-028). 15 hand-checkable unit tests.
- `FlythroughController` (plain class, one animation-frame loop, terrain sampled once, runtime
  terrain guard, mouse off while playing) and `FlythroughLayer` (one controller per route).
- Play / Pause button in the Trek tab (speed and jump-to-day are #20). Pressing a day pauses
  the flythrough; another trek stops it.
- Found while testing: Play pressed before World Terrain finished loading failed (Cesium leaves
  the provider undefined until then) → `play()` waits for it; a disabled button lost keyboard
  focus while preparing → `aria-disabled` instead.
- Screenshot `docs/screenshots/m4-flythrough-synthetic.png` (synthetic route, real terrain).

**Test evidence (local, Windows):** `npm run lint` clean; `npm run typecheck` clean; Vitest 114
passed; `npm run e2e` 11 passed. Mutation checks, each made a test fail: removing the curve's
distance table (unit test: steps 37.5–62.5 m instead of 50 m); removing "pause on day".

**Team next**

- Sparsh: play the flythrough on each real route once #9–#12 land; note whether speed, height
  and smoothness feel right (TODO(team): verify), and measure FPS during the flythrough for the
  NFR1 table (#29). Do exercises 14–16.

## 2026-11-22 · M3 #49 Daily stages (owner: Sparsh)

**Done**

- PR #51 (#16 trek selector) merged after green CI (ADR-021).
- `lib/geo/stages.ts`: each stop is put on the trail at its nearest point; the trail between two
  consecutive stops is that day's stage; out-and-back treks are handled; lengths come from the
  haversine table (#18). Hand-checkable Vitest cases on the equator (0.01° = 1,111.95 m).
- Trek tab: every stop after the first is a button with "N km along the trail from the previous
  stop" (computed). Pressing it highlights that stage in yellow on the globe and flies the camera
  to it; pressing again removes it; another trek clears it (ADR-027).
- First version drew the highlight UNDER the trail (zIndex does not cross data sources); found by
  looking at the screenshot, fixed by data-source order.
- Screenshot `docs/screenshots/m3-daily-stage-synthetic.png` (synthetic data).
- Code review found: (1) the camera aimed at sea level, so on a short stage high up it ended on
  the ground facing a hillside. Measured with World Terrain on a temporary 1.4 km test stage near
  4,900 m (not committed): 13 m above the ground before, about 3 km above after aiming at the
  higher stop's altitude. (2) A malformed file could now crash the page while rendering; the
  stage maths now runs inside `useRoutes`' `try`. Also: a cos(latitude) test at 60 °N, separate
  stage lengths, 0 m stages, a real Tab-key test, the stage choice keyed by trek, plainer clamps.

**Test evidence (local, Windows):** `npm run lint` clean; `npm run typecheck` clean; Vitest 99
passed; `npm run e2e` 9 passed. Mutation check: removing the "clear the stage on another trek"
line made `stages.spec.ts` fail.

**Team next**

- Sparsh: read `stages.ts` and `StageLayer.tsx`; work the projection example by hand (exercise 11).
- When real routes arrive (#9–#12), look at every stage on the globe and fix any stop that lands
  on the wrong pass of the trail (ADR-027 limits).

## 2026-11-22 · M3 #16 Trek selector panel (owner: Dipson)

**Done**

- PR #50 (#15 route layer) merged after green CI (ADR-021).
- Side panel with Trek / Plan / Layers tabs following the WAI-ARIA tabs pattern (arrow keys,
  Home/End, only the selected tab is a Tab stop). Plan and Layers show a placeholder until
  #24–#26.
- Trek tab: a native `<select>` listing every route in `data/routes/index.json`, the status line,
  and a "Day n · name · altitude m" list of overnight stops. Choosing a trek redraws the route and
  flies the camera to it. Route files are cached; a failed trek clears the map instead of leaving
  the old one (ADR-026).
- The footer is a plain `<footer>` again (contentinfo landmark); tests use
  `getByRole('contentinfo')`.
- 10 new strings in `en.json` and `ne.json` (machine-drafted Nepali, listed in
  `docs/i18n-review.md`); `routes.error` reworded; `panel.comingSoon` removed.
- e2e: second synthetic fixture route; new `trek-selector.spec.ts` (keyboard selection, cache,
  failed trek, late download, tabs). Screenshot `docs/screenshots/m3-trek-selector-synthetic.png`
  (synthetic data); the two older M3 screenshots refreshed because the panel changed. New helper
  `e2e/screenshot.ts` waits until no tile has arrived for 2 s, because one capture was taken
  before the terrain had loaded.
- Code review found a real race: the stale-download check compared trek ids, so choosing B, A,
  B quickly let both B downloads through (and a failed second one showed an error next to a
  drawn trek). Fixed by numbering the requests, with an e2e test that holds downloads back and
  releases them out of order. Also from the review: stronger tab tests, Tab stop on empty
  panels, 44 px touch targets, doc comments, docs.

**Test evidence (local, Windows):** `npm run lint` clean; `npm run typecheck` clean; Vitest 78
passed; `npm run e2e` 8 passed. Mutation checks, each made one e2e test fail: removing the
"clear the map" line; removing the cache; the old id-based check; removing the newest-request
check; removing the empty panels' `tabIndex`.

**Team next**

- Dipson: read `useRoutes.ts`, `TrekPanel.tsx`, `SidePanel.tsx`; try the tabs and selector with
  the keyboard only; review the new Nepali strings; do exercises 8–10 in the viva notes.
- Real treks appear in the selector once #9–#12 add route files.

## 2026-11-21 · M3 #15 Route line and stop markers (owner: Sparsh; index: Unique)

**Done**

- Routes are loaded at run time: `data/routes/index.json` (generated by `prep/route_index.py`,
  refreshed by `build_route`, checked by pytest) and then one `.geojson` (ADR-025).
- `ViewerContext`: layers inside `CesiumGlobe` reach the Viewer with `useViewer()`.
- `RouteLayer`: trail clamped to the ground, stop markers and labels, Cesium info-box popups with
  escaped HTML (name in both languages, altitude with source, day, description); everything for a
  route is one data source, removed in cleanup; the camera flies to the route.
- Side panel status line: loading / no trek data yet / could not load / "Showing … N overnight
  stops". `t()` gained `{name}` placeholders (a test checks both languages use the same holes).
- The real index is empty, so the live app says "No trek data yet". The e2e test serves a
  SYNTHETIC fixture route: `docs/screenshots/m3-route-layer-synthetic.png`.
- Follow-up issue #49 opened for FR2's "daily stages".
- Code review before merging found a real lifecycle bug (an add finishing after cleanup left old
  markers behind under StrictMode) plus smaller issues (fly-to on language change, a bad file
  could blank the page, inherited names in `t()` placeholders, `route_index.py` edge cases, no
  e2e check that markers were really drawn). All fixed with tests; e2e now 4 tests.

**Test evidence (local, Windows):** after merging main: `npm run lint` clean; `npm run typecheck`
clean; Vitest 74 passed; `npm run e2e` 4 passed; data-prep `pytest` 116 passed, 1 skipped.

**TEAM TODO:** Sparsh: exercises 9–10. Dipson: the new strings are listed in
`docs/i18n-review.md`.

---

## 2026-11-21 · M4 #18 Geo maths library (owner: Sparsh)

**Done**

- `app/src/lib/geo/distance.ts`: `haversineM` (proposal equation 3.2, calculator-safe worked
  example), `cumulativeDistancesM`, `locateDistance` (binary search from metres travelled to
  segment and t; clamps at the ends; refuses NaN) and `pointOnSegment`. Pure TypeScript, used by
  the flythrough (#19) and the elevation profile (#21).
- 18 Vitest cases with hand-checkable values. Code review found an un-reproducible worked example
  and three weak tests; fixed, and a mutation check then caught all five deliberate bugs.

**Test evidence (local):** `npx vitest run src/lib/geo` → 18 passed; lint and typecheck clean.

**TEAM TODO:** Sparsh: exercises 7–8; confirm the sphere-vs-ellipsoid error figure with a source.

---

## 2026-11-21 · M5 #23 Acclimatization rules (owner: Unique) · M7 #31 testing templates

**Done**

- `app/src/lib/acclim/checker.ts`: `checkItinerary` (too fast: S_d > 3000 and gain > 500; rest day
  needed: more than 3 nights in a row sleeping higher above 3,000 m) and `nightsFromStops`. Cites
  Luks et al. 2019/2024; details decided in ADR-024. Pure TypeScript, returns data for the UI.
- 25 Vitest cases (`checker.test.ts`) incl. exactly 3,000 m / exactly 500 m; a mutation check put
  five deliberate bugs in the rules and the tests caught every one. One weak test (a "reset" case
  that used a descent) was found by hand and replaced.
- #31 (merged as #45): `docs/testing/` templates for FPS, load time, altitude comparison, the
  acclimatization matrix (same cases as the tests) and the 10+ user questionnaire (SUS + project
  questions, printable form). All result cells are empty for the team.

**Test evidence (local):** `npx vitest run src/lib/acclim/checker.test.ts` → 25 passed;
`npm run lint` and `npm run typecheck` clean.

**TEAM TODO:** Unique: exercises 11–13; fill the Result column of the acclimatization matrix after
running the tests yourself.

---

## 2026-11-21 · M3 #14 Nepal-centred viewer (owner: Sparsh)

**Done**

- Camera starts over Nepal (450 km up at 84.1 °E, 22.8 °N, facing north, 35° down). Where it
  looks is computed in `engine/nepalView.ts` two ways, both tested: flat-earth estimate about
  28.58 °N, exact on a round Earth about 29.08 °N. The Cesium calls live in `engine/camera.ts`;
  the home button flies back to this view.
- `requestRenderMode` on (ADR-023). The OpenStreetMap credit (text from the i18n files) is shown
  on the map next to Cesium's (`engine/credits.ts`), and the e2e test checks for it.
- Screenshot from the real build with the token: `docs/screenshots/m3-nepal-start-view.png`
  (the README now shows it). A first attempt 0.5° further north showed mostly Tibet.
- Code review before the PR found that the notes had the Earth's curvature the wrong way round
  (the exact aim point is farther, not nearer), that the cos(latitude) term was untested, that
  pitch >= 0 was not rejected, and that the credit text was hard-coded; all fixed, with tests.

**Test evidence (local, Windows):** `npm run lint` clean; `npm run typecheck` clean; Vitest
18 passed (3 files); `npm run e2e` 1 passed, both with the token and with
`VITE_CESIUM_ION_TOKEN=` (the offline imagery CI uses).

**TEAM TODO:** Sparsh: read the engine files and do exercises 2, 5 and 6. Set
`CESIUM_ION_TOKEN` (Q2) so the live site shows terrain too.

---

## 2026-11-21 · Repository housekeeping and proposal alignment

**Done**

- **Contributors (ADR-020):** `main` replaced by the same history without AI co-author lines and
  with the laptop's e-mail typo fixed (no force-push: new branch + GitHub branch rename). Checked:
  identical file tree, same 11 commits, 0 Claude lines; contributors API now lists `dipson6525`
  only. Old history kept in `archive/old-main-with-claude`.
- **Collaborators:** Unique-Ghimire and sparshgorkhali5-wq invited with write access (Q1).
- **PRs:** #38–#40 were closed by GitHub during the swap and re-opened as #41 (schema), #42 (UI
  design) and #43 (pipeline); all three merged after green CI under ADR-021. Issues #6, #7 and #8
  are closed. #42 needed `main` merged in (append-only conflicts in four docs files, both sides
  kept).
- **Proposal alignment (ADR-022):** read the submitted proposal; FRs renumbered to its Table 4.1
  across docs, code headers and issues; NFR11 (ease of use) added; GDAL and "daily stages"
  differences recorded in `docs/requirements.md` for the final report.

**Test evidence:** after merging main into the UI branch: `pytest` 111 passed, 1 skipped;
`npm run lint` clean; `npm run typecheck` clean; Vitest 5 passed. CI green on #41, #42, #43.

**TEAM TODO:** accept the GitHub invitations; set `CESIUM_ION_TOKEN` (Q2, still missing);
answer Q13–Q15.

---

## 2026-11-21 · M2 #8 Data-prep pipeline (owner: Unique)

**Done (for Unique to review)**

- `prep/overpass.py`: one cached Overpass request per route; User-Agent, `[timeout:60]` + 90 s
  request timeout, no retry loop, refuses to run when `CI` is set; the cache file keeps the query,
  UTC fetch date and ODbL licence line, and a cache made by a different query is refused.
- `prep/build_route.py`: TOML route spec → ways → one merged trail (stops on gaps, never bridges
  them) → oriented to the first stop → Douglas–Peucker in metres (UTM zone of the line, default
  5 m) → stops added → schema check → `data/routes/<id>.geojson`, one feature per line.
- `route-specs/_template.toml` + README; ADR-019; route-data skill, data-prep README and
  route-sources.md updated; glossary (EPSG, linemerge, TOML, UTM); Unique's viva notes.
- Code review before the PR: closed loops (parallel or duplicate ways) and stops more than 500 m
  from the trail now stop the build; bad specs, damaged caches, network errors and malformed
  Overpass answers give clear errors instead of crashes; one test could have reached the network
  and now cannot.
- No real Overpass query yet: choosing the EBC ways is #9.

**Test evidence (local, Windows)**

```
data-prep> ruff check .   → All checks passed!
data-prep> pytest -q -W error::DeprecationWarning → 111 passed, 1 skipped
```

**TEAM TODO:** review #38 first (this branch builds on it), then this PR. Unique: pick the OSM
ways for EBC and run the first real build (#9).

---

## 2026-11-20 · M1 #7 Component tree and wireframes (owner: Dipson)

**Done (for Dipson to review)**

- `docs/ui-design.md`: layout rules (globe first, disclaimer as a footer grid row, credits in
  Cesium's credit area, 900 px breakpoint), component tree with owner and issue per component,
  shared-state table and data-flow diagram, desktop wireframes for the Trek, Plan and Layers
  tabs, a tablet (768 px) wireframe, and the screen states to design for (no token, loading,
  offline, WebGL missing).
- ADR-018 (UI structure and shared state), glossary terms, Dipson's viva notes.

**Evidence:** docs only. Wireframe boxes were generated by a script and checked: every line in
each of the 4 wireframes has the same width. Both Mermaid diagrams pass Mermaid's own parser
(mermaid 12 + jsdom). A viva-examiner subagent checked the design and notes against the code; its
corrections are in the PR (hover context, flythrough commands as method calls, accurate
accessibility notes, "element today" labels).

**TEAM TODO:** Dipson reviews the merged design (merged as #42 while the repo owner was
away, ADR-021) and checks both Mermaid diagrams on GitHub.

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
- Viva notes (Unique): validator walkthrough, code details, limits, worked examples, questions
  7–18, exercises 5–7, AI-use section. Checked by the code-reviewer and viva-examiner subagents;
  their findings are fixed (see PR #38).

**Test evidence (local, Windows)**

```
data-prep> ruff check .       → All checks passed!
data-prep> pytest -q          → 59 passed, 1 skipped (the real-files test: no route files yet)
data-prep> python -m prep.schema → No .geojson files in data/routes yet.
app> npm run lint / typecheck / test → clean · clean · 5 passed (incl. route type guards)
```

**TEAM TODO:** Unique reviews and merges PR #38; confirm the 4th route (Q6) before #12; decide on
branch protection for `main` (Q12).

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
