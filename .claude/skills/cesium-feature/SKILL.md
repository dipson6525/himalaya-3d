---
name: cesium-feature
description: Checklist for adding or changing a CesiumJS feature in the React app — Viewer lifecycle, entity cleanup, requestRenderMode, credits, performance budget, Vitest for the maths and a Playwright screenshot. Use for anything under app/src/engine/ or any feature that draws on the globe.
---

# Adding a CesiumJS feature

## 1. Keep the maths pure

Put calculations (distances, splines, sampling, ascent totals) in `app/src/lib/**` as plain
TypeScript functions with no Cesium Viewer and no React. Write Vitest tests next to them
(`name.test.ts`) with hand-checkable numbers. Doc-comment every function with WHAT, WHY and the
formula.

## 2. Viewer lifecycle (React)

- There is ONE Viewer, created in `src/engine/CesiumGlobe.tsx` inside `useEffect`, and destroyed
  in the cleanup. Never create a second Viewer.
- Features receive the viewer (prop/context) and add things in their own `useEffect`.
- **Every effect that adds entities, primitives, data sources or event listeners must remove them
  in its cleanup** (`viewer.entities.remove(e)`, `dataSource` removal, `handler.destroy()`,
  `removeListener()`). Switching routes must leave no leftovers.
- Guard against a destroyed viewer: `if (viewer.isDestroyed()) return;` in async callbacks.
- React StrictMode runs effects twice in dev — your cleanup must make that harmless.

## 3. Rendering & performance budget

- `requestRenderMode: true` is the target (issue #14). After changing anything that is not an
  entity property, call `viewer.scene.requestRender()`.
- Target ≥ 30 fps on integrated graphics (NFR). Do not invent FPS numbers — the team measures
  them with the FPS overlay (issue #29) and records them in `docs/testing/`.
- Prefer `clampToGround` polylines over sampling heights for drawing; sample terrain
  (`sampleTerrainMostDetailed`) only for data you need (elevation profile), and cache results.
- Avoid per-frame allocations in `preRender`/`postRender` listeners (reuse `Cartesian3` scratch objects).

## 4. Credits & token

- Cesium's credit display must stay visible. OSM, USGS and Open-Meteo credits must also be on
  the map whenever their data is shown.
- Read the token only via `import.meta.env.VITE_CESIUM_ION_TOKEN` (in `cesiumSetup.ts`).
  Features must still work (degraded) without a token — CI has none.

## 5. Strings

All visible text goes in `app/src/i18n/en.json` AND `ne.json` (same keys; tests enforce it).

## 6. Test & evidence

- `npm run lint && npm run typecheck && npm test` in `app/`.
- Add or extend a Playwright test in `app/e2e/` and save a screenshot to `docs/screenshots/`.
- Open the app with the Playwright MCP, exercise the feature, compare with the issue's
  acceptance criteria.

## 7. Wrap-up

Header comment on new files (purpose, owner, FR), PR with "Owner to review: <name>" and
"Closes #n", then update `docs/PROGRESS.md` and the owner's viva notes (viva-notes skill).
