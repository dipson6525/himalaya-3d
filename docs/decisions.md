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

## ADR-019 · Route data pipeline (Unique, 2026-11-20)

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
- `prep/build_route.py` merges the ways with `shapely.ops.linemerge`. **If they do not form one
  continuous line, the build stops**: we never draw missing trail by hand. The line is then
  turned to start at the first stop and simplified with Douglas-Peucker in metres (projected to
  the UTM zone of the line's centre, EPSG 32644 or 32645 in Nepal). Coordinates are rounded to 6
  decimals (about 0.1 m). The result must pass the schema validator before it is written, one
  feature per line.
- Default tolerance **5 m**: every point of the simplified line stays within 5 m of the OSM line,
  which is a tenth of the 50 m spacing planned for elevation sampling (#21), so simplification
  cannot noticeably change the profile. TODO(team): check visually on the globe in M3 and record
  any change here.
**Alternatives:** querying all paths in a bounding box (pulls in side trails and needs manual
cleaning anyway); simplifying in degrees (a tolerance in degrees means different metres east-west
and north-south); GDAL/ogr2ogr (not installed, ADR-006); bridging small gaps automatically
(invents geometry).
**Consequences:** Building a new route needs the right OSM way list; a missing way shows up as a
clear error. Re-running is offline and deterministic once the cache file is committed.
