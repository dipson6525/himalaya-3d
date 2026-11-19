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
**Consequences:** One source of truth (`base` in `vite.config.ts`). The e2e smoke test fails on
any 404, which catches mistakes before deploy.

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

**Decision:** `engines.node >= 20`. CI uses the current LTS (`lts/*`); the laptop runs Node 26.

## ADR-012 · Only one MCP server: Playwright (Team, 2026-11-19)

**Decision:** Playwright MCP (project scope, `.mcp.json`) lets Claude Code open the app and take
screenshots. GitHub work uses the `gh` CLI, so no GitHub MCP server.
**Note:** On native Windows, if Claude Code cannot start `npx` directly, change the command to
`"cmd"` with args `["/c", "npx", "-y", "@playwright/mcp@latest"]` in a local override.

## ADR-013 · LF line endings everywhere (Team, 2026-11-19)

**Context:** Git on Windows converts to CRLF by default, which makes Prettier's check fail.
**Decision:** `.gitattributes` forces `eol=lf` in the working copy.
