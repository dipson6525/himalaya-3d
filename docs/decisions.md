# Decisions (lightweight ADRs)

Each entry: context → decision → consequences. Newest at the bottom. Owner of a decision is
whoever owns the affected area (see CLAUDE.md); team-wide decisions are marked "Team".

---

## ADR-001 · Static site on GitHub Pages, no custom server (Team, 2026-11-19)

**Context:** The app needs to be free to host and simple to maintain by three students.
**Decision:** Build a static React site, deploy it with GitHub Actions to GitHub Pages. Offline
data work happens in Python and is committed as GeoJSON. Live data comes from public APIs that
need no secret key (USGS, Open-Meteo).
**Consequences:** No backend to secure. The Cesium ion token is visible in the built JS, so the
production token must be restricted to the Pages URL on cesium.com. The repo must be public for
free Pages.

## ADR-002 · React + Vite + TypeScript 6.0 (strict) (Team, 2026-11-19)

**Context:** TypeScript 7.0 is the newest release, but `typescript-eslint` 8.73 (latest) only
supports TypeScript `< 6.1`.
**Decision:** Use TypeScript 6.0.x with `strict: true`, Vite 8, React 19.
**Consequences:** Lint and typecheck work together. Upgrade to TS 7 once typescript-eslint supports it.

## ADR-003 · Serve Cesium's static files ourselves; set CESIUM_BASE_URL from Vite's BASE_URL (Sparsh, 2026-11-19)

**Context:** Cesium loads web workers, images and CSS at runtime from a base URL. On GitHub Pages
the site lives under `/himalaya-3d/`, on localhost under `/`.
**Decision:** `vite-plugin-static-copy` copies `Build/Cesium/{Workers,ThirdParty,Assets,Widgets}`
to `<base>cesium/`. `src/engine/cesiumSetup.ts` sets
`window.CESIUM_BASE_URL = import.meta.env.BASE_URL + 'cesium/'`.
**Alternatives:** Vite `define` of a hard-coded path (easy to get out of sync with `base`).
**Consequences:** The base path has one source of truth (`base` in `vite.config.ts`). The folder
name `cesium` is still written twice (`dest` in `vite.config.ts`, the string in `cesiumSetup.ts`);
comments on both lines point at each other, and the e2e smoke test fails on any 404, which
catches a mismatch before deploy.

## ADR-004 · Vite `envDir` = project root (Sparsh, 2026-11-19)

**Context:** The team keeps `.env.local` in the project root, but the Vite project is in `app/`.
**Decision:** `envDir` points one folder up. `.env.local` is never opened by tools or committed.
**Consequences:** `import.meta.env.VITE_CESIUM_ION_TOKEN` works in dev and local builds; CI passes
the token as an environment variable from the `CESIUM_ION_TOKEN` secret.

## ADR-005 · Offline fallback imagery when no token; CI tests run without the token (Sparsh, 2026-11-19)

**Context:** CI runs on pull requests, where secrets should not be needed, and new teammates may
not have a token yet.
**Decision:** Without a token, the Viewer uses Cesium's bundled NaturalEarthII imagery on a smooth
ellipsoid and shows a notice. CI's Playwright tests run against this fallback.
**Consequences:** Tests are deterministic and don't use ion quota. Terrain-specific checks
(e.g. altitude cross-check) must run locally with a token.

## ADR-006 · Python data-prep without GDAL (Unique, 2026-11-19)

**Context:** GDAL is not installed on the team laptop and does not pip-install cleanly on Windows.
**Decision:** Use `gpxpy` (GPX), `shapely` (geometry, simplification) and `pyproj` (projections).
Python 3.12 locally and in CI; code stays compatible with 3.11 (`requires-python >= 3.11`).
**Consequences:** No raster processing in Python. Terrain heights come from Cesium
(`sampleTerrainMostDetailed`) in the browser instead.

## ADR-007 · Tiny home-made i18n instead of react-i18next (Dipson, 2026-11-19)

**Context:** We need two languages and a few dozen strings.
**Decision:** `t(key, language)` over two JSON files. TypeScript derives the key type from
`en.json`; a Vitest test checks both files have identical keys.
**Consequences:** ~20 lines anyone can explain. No pluralisation/formatting features; revisit if needed.

## ADR-008 · Where tests live (Team, 2026-11-19)

**Decision:** Unit tests sit next to the module (`src/lib/acclim/checker.test.ts`); checks that
span modules go in `app/tests/`; Playwright tests in `app/e2e/`; Python tests in `data-prep/tests/`.

## ADR-009 · Repository owner and visibility (Team, 2026-11-19)

**Context:** The gh CLI on this laptop is logged in as `dipson6525`.
**Decision:** The repo is `dipson6525/himalaya-3d`, public (needed for free GitHub Pages).
Teammates are added as collaborators. No GitHub Project board yet: the gh token lacks the
`project` scope (`gh auth refresh -s project` to add it).

## ADR-010 · Milestone dates (Team, 2026-11-19)

**Decision:** Milestone due dates assume semester week 1 starts Monday 2026-11-16.
TODO(team): verify against the real semester calendar and shift the due dates if needed.

## ADR-011 · Node version (Team, 2026-11-19)

**Context:** CesiumJS 1.147 needs Node `>= 22.17`; Vitest 5 and vite-plugin-static-copy 4 do not
support Node 23 or 25 (odd-numbered, non-LTS releases).
**Decision:** `engines.node` is `^22.17.0 || ^24.0.0 || >=26.0.0`. CI uses the current LTS
(`lts/*`); the laptop runs Node 26.

## ADR-012 · Only one MCP server: Playwright (Team, 2026-11-19)

**Decision:** Playwright MCP (project scope, `.mcp.json`, pinned to a fixed version so it does not
change under us) lets Claude Code open the app and take screenshots. GitHub work uses the `gh` CLI, so no GitHub MCP server.
**Note:** On native Windows, if Claude Code cannot start `npx` directly, change the command to
`"cmd"` with args `["/c", "npx", "-y", "@playwright/mcp@0.0.86"]` in a local override.

## ADR-013 · LF line endings everywhere (Team, 2026-11-19)

**Context:** Git on Windows converts to CRLF by default, which makes Prettier's check fail.
**Decision:** `.gitattributes` forces `eol=lf` in the working copy.

## ADR-014 · Deploy only after CI passes on main (Team, 2026-11-19)

**Context:** If deploy ran on every push to main, a commit with failing tests would still be
published.
**Decision:** `deploy.yml` is triggered by `workflow_run` when the CI workflow completes on `main`,
and only deploys if CI succeeded (plus a manual `workflow_dispatch`). It builds the exact commit CI tested.
**Consequences:** A deploy starts a few minutes later (after CI). A red main never reaches the live site.

## ADR-015 · Screenshots are written only on request (Team, 2026-11-19)

**Context:** Writing `docs/screenshots/*.png` on every e2e run changed committed files, and the
image depended on whether the local machine had a token.
**Decision:** e2e tests save screenshots only when `UPDATE_SCREENSHOTS=1` is set
(bash: `UPDATE_SCREENSHOTS=1 npm run e2e`; PowerShell: `$env:UPDATE_SCREENSHOTS=1; npm run e2e`). The PR author regenerates them deliberately and states in the PR
whether a token was used.

## ADR-016 · No AI co-author lines in commits; disclose AI use in docs instead (Team, 2026-11-20)

**Context:** Claude Code added `Co-Authored-By: Claude …` to each commit, which made GitHub list
Claude as a repository contributor. The team wants only its members listed.
**Decision:** `.claude/settings.json` sets `"attribution": {"commit": "", "pr": ""}`, so Claude Code
adds no co-author trailer or "Generated with" line for anyone on the team. This repo's git email was
also corrected (the laptop's global setting has a typo, `kuedu.np` instead of `ku.edu.np`), so new
commits are credited to the owner's GitHub account.
**Alternative rejected:** rewriting `main` to strip the trailers from the first 8 M0 commits. It
needs a force-push, which our ground rules forbid, so the team chose to keep that history as it is.
**Consequences:** Claude stays in GitHub's contributor list because of those 8 M0 commits; no later
commit adds to it. AI assistance is disclosed in `docs/AI_USAGE.md` (and in the report).
**Update 2026-11-21:** superseded in part by ADR-020 — the team later chose to replace `main` with
a cleaned history, so Claude no longer appears in the contributor list. The disclosure stays.

## ADR-017 · Route file schema (Unique, 2026-11-20)

**Context:** The app, the data pipeline and the acclimatization checker all read route files, so
their format must be fixed early and checked automatically (issue #6).
**Decision:** One GeoJSON FeatureCollection per route (`data/routes/<route-id>.geojson`) with one
`route` LineString feature and one `stop` Point feature per overnight stop, in walking order
(`docs/data-schema.md`). Positions live only in geometry (`[lon, lat]`), not duplicated as
properties. There is no rest-day field: nights at a stop = next stop's `day` − this stop's `day`.
Every altitude names a Source ID from `route-sources.md`. Values containing `TODO` and unknown
property names are rejected. The validator (`data-prep/prep/schema.py`) is plain Python and runs
in CI through pytest; a matching TypeScript type lives in `app/src/features/routes/types.ts`.
**Alternatives:** a JSON Schema file plus the `jsonschema` library (cannot express "days increase"
or "Source ID listed in a Markdown table", and is harder to explain); one big file for all routes
(every edit would touch everyone's data). The early plan had a `region` field; it was left out until a
feature needs it.
**Consequences:** A route line must be one continuous LineString; if OSM has gaps, the pipeline
(#8) has to deal with them and record how. Schema changes need the doc, validator, tests and
TypeScript types updated together.

## ADR-018 · UI structure and shared state (Dipson, 2026-11-20)

**Context:** From M3 on, several features built by different people must work on one screen and
share values such as the selected trek (issue #7, `docs/ui-design.md`).
**Decision:**
- Layout: globe as main content; a 320 px side panel with three tabs (Trek, Plan, Layers); an
  elevation-profile strip under the globe; the medical disclaimer as a footer row of the page grid;
  stacked in one column at 900 px or narrower.
- Credits: added to Cesium's own credit area as `new Credit(html, true)` (shown on screen, not
  only in the "Data attribution" pop-up) with `viewer.creditDisplay.addStaticCredit`, plus the
  Open-Meteo credit next to weather values in the panel.
- Shared state: values that change rarely and are used by several branches of the component tree
  live in `App` and are passed down through one React context (`AppState`, 7 values). The chart
  hover position changes many times a second, so it has its own small `ProfileHoverContext`. The
  Cesium Viewer and the flythrough controller are shared through `ViewerContext`.
- Derived values (acclimatization warnings) are recalculated, not stored. Per-frame flythrough
  positions stay inside the engine. Flythrough commands are method calls on the controller, not
  state.
- Accessibility: WAI-ARIA tabs pattern for the side panel; `<html lang>` follows the language.
**Alternatives:** a state library such as Redux or Zustand (more to learn and explain for about
eight shared values); passing props down through every level ("prop drilling"), which gets messy
once the globe and the side panel both need the same value; the profile as a side-panel tab (too
narrow for a multi-day chart); one context for everything (every hover would re-render every
component that reads it).
**Consequences:** One place to look for rarely-changing shared values. Every component that reads
a context re-renders when it changes, so anything that changes often must stay out of `AppState`.

## ADR-019 · Route data pipeline (Unique, 2026-11-21)

**Context:** Issue #8. Route lines must come from OpenStreetMap, be reproducible, respect the
Overpass service, and end up in the ADR-017 format.
**Decision:**
- One hand-written **route spec** per trek (`data-prep/route-specs/<id>.toml`, TOML read with the
  standard-library `tomllib`): names, descriptions, the OSM relation id OR the list of way ids,
  the simplification tolerance and the stops (with lon/lat and cited altitudes).
- `prep/overpass.py` sends at most one query per route, with a User-Agent, `[timeout:60]` in the
  query and a 90 s request timeout, and no retry loop. It refuses to run when `CI` is set, and
  saves the answer to `data-prep/cache/<id>-ways.json` together with the exact query, the fetch
  date and the ODbL licence line. A cache made by a different query is refused, not silently used.
  The query text is compared exactly, so changing `QUERY_TIMEOUT_S` or reordering `osm_ways`
  makes every committed cache file stale: do that only on purpose, and re-fetch afterwards.
- `prep/build_route.py` merges the ways with `shapely.ops.linemerge`. **The build stops** if the
  ways do not form one continuous line (a gap or a side branch) or if they form a **closed loop**
  (a parallel alternative path or a way listed twice; route relations can contain such ways). We
  never draw missing trail by hand. The line is then turned to start at the first stop.
- **Every stop must lie within 500 m of the trail line**, or the build stops: a stop further away
  almost always means a typo in its lon/lat or a wrong way list. 500 m is a team choice that allows
  for villages set back from the path. TODO(team): confirm or change it when the first real routes
  are built (#9–#12).
- The line is simplified with Douglas-Peucker in metres (projected to the UTM zone of the line's
  centre, EPSG 32644 or 32645 in Nepal). Coordinates are rounded to 6 decimals (about 0.1 m). The
  result must pass the schema validator before it is written, one feature per line.
- Bad input (a spec that is not UTF-8 or not valid TOML, missing or misspelt keys, way ids that
  are not whole numbers, a negative tolerance, a damaged cache file, no connection, a non-JSON
  answer) gives a one-line error message, never a crash.
- Default tolerance **5 m**: every point of the simplified line stays within 5 m of the OSM line,
  which is a tenth of the 50 m spacing planned for elevation sampling (#21), so simplification
  should not noticeably change the profile. TODO(team): check visually on the globe in M3 and
  record any change here.
**Alternatives:** querying all paths in a bounding box (pulls in side trails and needs manual
cleaning anyway); simplifying in degrees (a tolerance in degrees means different metres east-west
and north-south); GDAL/ogr2ogr (not installed, ADR-006); bridging small gaps automatically
(invents geometry).
**Consequences:** Building a new route needs the right OSM way list; a missing way shows up as a
clear error. Re-running is offline and deterministic once the cache file is committed.

## ADR-020 · Replace `main` with a history without AI co-author lines (Team, 2026-11-21)

**Context:** The repo owner wanted Claude removed from GitHub's contributor list (it came from
`Co-Authored-By` lines in the first M0 commits, ADR-016). A force-push is denied in the project's
Claude Code settings, and our §0 rule said never to rewrite `main`; the owner chose to override
that rule once.
**Decision:** On 2026-11-21:
1. A copy of `main` was rewritten locally with `git filter-branch`: the Claude co-author lines
   were removed from commit messages and the laptop's mistyped e-mail domain (`kuedu.np`) was
   corrected to `ku.edu.np`. Checked: the file tree is identical to the old `main`, the same 11
   commits, no Claude lines left.
2. It was pushed as a new branch (no force-push), the old `main` was renamed to
   `archive/old-main-with-claude` with GitHub's branch-rename API, the new branch was renamed to
   `main` and made the default branch.
3. The three open PRs had the old history underneath, so merging them would have brought the old
   commits back. They were replayed onto the new `main` (`git rebase --onto`; files identical) and
   re-opened as #41, #42 and #43. GitHub closed the originals (#38–#40) when their branches were
   renamed to `archive/old-*`; each has a comment pointing to its replacement.
**Consequences:** GitHub's contributors API lists only team members (the web page can lag). Anyone
who cloned before 2026-11-21 must re-clone (nobody had). Closed PR pages #36–#40 still show the
old commits; GitHub keeps PR history. The `archive/old-*` branches keep everything reversible
(Q15). AI assistance remains disclosed in `docs/AI_USAGE.md`.

## ADR-021 · Who merges pull requests while the repo owner is away (Team, 2026-11-21)

**Context:** CLAUDE.md says feature PRs are merged by the owning student. The repo owner asked
for the project to keep moving while they are away; unmerged PRs would block dependent issues.
**Decision:** Until the team says otherwise, a PR is merged by the repo owner's account once CI is
green and the automated code review has no open correctness findings. One PR per issue still;
owners review the merged code afterwards, raise issues for anything they disagree with, and do
their own viva exercises by hand.
**Consequences:** Faster progress; less review before merge, so owners must read their merged
modules before the viva. Unique and Sparsh become GitHub contributors through their own commits
(for example the viva exercises and fixes), not through these merges.

## ADR-022 · FR numbers follow the proposal (Team, 2026-11-21)

**Context:** The first `docs/requirements.md` numbered the FRs differently from Table 4.1 of the
submitted proposal (it split routes and stops), which would confuse the final report.
**Decision:** Use the proposal's FR1–FR9 everywhere: old FR3 → FR2, FR4 → FR3, FR5 → FR4,
FR6 → FR5 (checker) and FR6 (editable itinerary). Code headers, docs, viva notes and the GitHub
issues were updated. NFR11 (ease of use for people new to 3D software) was added from the proposal.
**Consequences:** One numbering in code, issues, docs and report.

## ADR-023 · Start view, home button and request-render mode (Sparsh, 2026-11-21)

**Context:** Issue #14 (FR1): the globe should open over Nepal with the mountains readable, credits
visible, and run smoothly on laptops with integrated graphics (NFR1).
**Decision:**
- The camera starts 450 km up at 84.1 °E, 22.8 °N (south of Nepal), facing north, 35° down, so
  the Nepal Himalaya is seen from the side rather than from above. Where the line of sight meets
  the ground is computed in `nepalView.ts` two ways, both unit tested: a flat-earth estimate
  (642.7 km away, about 28.58 °N) and the exact answer on a round Earth (about 698.7 km away,
  about 29.08 °N — farther, because the ground curves away below a flat plane).
- The view was chosen by comparing two screenshots of the real build: a camera 0.5° further north
  (exact aim about 29.58 °N) showed mostly the Tibetan plateau; this one centres Nepal's hills and
  the Himalayan crest (`docs/screenshots/m3-nepal-start-view.png`).
- The home button is redirected (`beforeExecute` → `cancel = true`) to fly back to the start view.
- `requestRenderMode: true` and `maximumRenderTimeChange: Infinity`: Cesium redraws only when
  something changes, instead of about 60 times a second. Cesium notices camera moves, flights,
  tile loads and window resizes by itself; code that changes the scene in other ways must call
  `scene.requestRender()`.
- The OpenStreetMap credit is always on screen (`new Credit(html, true)`), next to Cesium's; its
  text comes from the i18n files (`credits.osm`).
**Consequences:** Less GPU work while idle (the team measures the effect in #29, not assumed
here). Clock-driven features (sun slider #28, flythrough #19) must request renders or lower
`maximumRenderTimeChange`. The credit area only updates when a frame is drawn, so live layers
that add or remove credits (#25, #26) must call `requestRender()` afterwards.
