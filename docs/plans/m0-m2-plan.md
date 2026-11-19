# Plan — M0 to M2

Written 2026-11-19 before any feature code. Approve or edit this before M1/M2 work starts.

## M0 — Requirements & setup (wk 1–2) · issues #1–#5 · status: done in PR (scaffolding)

| Step | Output | Issue |
| --- | --- | --- |
| Repo, labels, 9 milestones, 35 issues | github.com/dipson6525/himalaya-3d | — |
| App scaffold: React 19 + Vite 8 + TS 6 strict + CesiumJS 1.147, envDir = root, base path, offline fallback | `app/` | #1 |
| Data-prep scaffold: venv, pinned gpxpy/shapely/pyproj, ruff, pytest | `data-prep/` | #1 |
| CI (lint, typecheck, Vitest, build, Playwright, ruff, pytest) + Pages deploy | `.github/workflows/` | #2 |
| Requirements FR1–FR9 + NFRs; architecture with Mermaid | `docs/requirements.md`, `docs/architecture.md` | #3, #4 |
| Claude skills, subagents, Playwright MCP, AI usage disclosure | `.claude/`, `.mcp.json`, `docs/AI_USAGE.md` | #5 |

## M1 — Design (wk 3–4) · issues #6, #7

### #6 Route data schema + validator (Unique) — branch `unique/data-schema`
1. `docs/data-schema.md`: one GeoJSON `FeatureCollection` per route.
   - A GeoJSON FeatureCollection has no standard `properties` field, so route metadata lives in
     a `route` Feature (LineString) with `id`, `name_en`, `name_ne`, `region`, `source_ids`.
   - One `stop` Feature (Point) per overnight stop: `name_en`, `name_ne`, `altitude_m`,
     `altitude_source` (Source ID), `day`, `description_en`, `description_ne`.
     `lat`/`lon` come from the Point geometry `[lon, lat]` (not duplicated, to avoid mismatches).
2. `data-prep/prep/schema.py`: plain-Python validator (no extra library) returning a list of
   readable errors (missing field, wrong type, day not increasing, unknown source ID, lat/lon
   outside Nepal's bounding box).
3. `data-prep/tests/test_schema.py`: valid sample passes; each kind of error is caught; and
   *every* file in `data/routes/` is validated (so CI guards real data).
4. TypeScript mirror type in `app/src/features/routes/types.ts` (owner Sparsh/Unique) for M3.

### #7 Component tree + wireframes (Dipson) — branch `dipson/ui-design`
1. `docs/ui-design.md`: Mermaid component tree (App → Header[LanguageToggle] → Globe
   [RouteLayer, StopMarkers, FlythroughCamera, QuakeLayer] → SidePanel[TrekSelector,
   FlythroughControls, ElevationProfile, ItineraryEditor, LayerToggles, SunSlider] → Disclaimer).
2. ASCII/Markdown wireframes at desktop (≥ 1280 px) and tablet (768 px) widths.
3. Shared state plan: selected route id, selected day, flythrough position, language — held in
   one React context (`AppState`) so components stay simple.

## M2 — Route data (wk 3–6) · issues #8–#13 (owner Unique)

### #8 Pipeline — branch `unique/overpass-pipeline`
1. `prep/overpass.py`: `fetch_cached(name, query)` — returns the cached file if present; else one
   POST with User-Agent + 90 s timeout, saves JSON, no retry loop.
2. `prep/build_route.py`: ways → merged LineString (shapely `linemerge`) → project to UTM 45N
   (EPSG:32645) → `simplify(tolerance)` → back to WGS84 → write GeoJSON with stops from a
   hand-curated `data-prep/stops/<route>.csv` (each row cites a Source ID).
3. pytest for merging/simplifying with tiny synthetic lines (no network in tests).

### #9–#12 Routes — one branch + PR per route (`unique/route-ebc`, …)
- EBC: Lukla, Namche Bazaar, Tengboche, Dingboche, Lobuche, Gorak Shep (+ rest days).
- Annapurna Circuit, Langtang Valley, and the 4th route (**proposal: Manaslu Circuit** — it crosses
  a high pass and so exercises the acclimatization checker more than the shorter Mardi Himal;
  team to confirm, Q6).
- Altitudes: typed only from a cited publication by Unique; Claude Code will **not** fill in
  altitudes from memory. Unfilled values stay `TODO(team): verify` and the validator rejects them
  from `data/routes/` until filled.

### #13 Altitude cross-check — branch `unique/altitude-check`
- Small browser-side script (needs the token, so runs locally, not in CI) samples Cesium World
  Terrain at each stop and writes `docs/testing/altitude-comparison.md`; rows > 50 m flagged.

## Order of work and hand-offs

```
#6 schema ─┬─> #8 pipeline ─> #9 EBC ─> #10 ACAP ─> #11 Langtang ─> #12 4th ─> #13 check
#7 design ─┘                    └─(first route unblocks Sparsh's #14/#15 in M3)
```

## What the team must provide

- Q6: 4th route choice. Q4/Q5: proposal FR numbering, semester week 1 date.
- Unique: the published sources (book/map/park page) for each stop's altitude.
