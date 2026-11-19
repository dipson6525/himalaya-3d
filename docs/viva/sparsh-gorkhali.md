# Viva notes — Sparsh Gorkhali (041054-25)

Areas: 3D engine (`app/src/engine/`), geo maths (`app/src/lib/geo/`), flythrough, performance,
testing lead (M7). Labels: `area:3d-engine`, `area:flythrough`, `area:performance`.

## Your part in one paragraph

You own everything that draws the 3D world. In M0 that is the plumbing: how CesiumJS is
configured so it works both on `localhost` and on GitHub Pages, and a React component that
creates and safely destroys the Cesium Viewer. In M3 you centre the globe on Nepal and draw the
routes and stops; in M4 you build the flythrough (spline path, constant speed, smooth camera);
in M7 you lead performance measurement and testing.

## File map (so far)

| File | Purpose | FR |
| --- | --- | --- |
| `app/vite.config.ts` | Base path `/himalaya-3d/`, copies Cesium's static files, `envDir` = project root | NFR7 |
| `app/src/engine/cesiumSetup.ts` | Sets `window.CESIUM_BASE_URL` and the ion token | FR1 |
| `app/src/engine/CesiumGlobe.tsx` | Creates/destroys the one Cesium Viewer; offline fallback without a token | FR1 |
| `app/playwright.config.ts` | Runs e2e tests against the production build under `/himalaya-3d/` | all |
| `app/e2e/smoke.spec.ts` | Smoke test: app loads, canvas renders, credits + disclaimer, no 404s | FR1, NFR5–6 |
| `.github/workflows/deploy.yml` | Builds with the token secret and publishes to Pages | NFR7 |

Coming next: `app/src/lib/geo/` (haversine, cumulative distance — #18), flythrough (#19, #20).

## Module walkthroughs

### `vite.config.ts` — why the base path matters

GitHub Pages serves our site at `https://<user>.github.io/himalaya-3d/`, not at the domain root.
If the HTML asked for `/assets/app.js`, the browser would look at
`https://<user>.github.io/assets/app.js` — the wrong place → 404 → blank page. Setting
`base: '/himalaya-3d/'` for production makes Vite write `/himalaya-3d/assets/app.js` instead.
In dev (`npm run dev`) the base is `/` because the dev server runs at the root.

### Cesium's static files and `CESIUM_BASE_URL`

Vite bundles our JavaScript, but CesiumJS also needs files it loads *at runtime*: web workers
(background threads that decode terrain and geometry), images (e.g. the offline globe texture),
CSS for its widgets, and third-party code. We copy those four folders into `dist/cesium/` with
`vite-plugin-static-copy`, then tell Cesium where they are:

```
window.CESIUM_BASE_URL = import.meta.env.BASE_URL + 'cesium/'
//  dev:   "/" + "cesium/"            = "/cesium/"
//  Pages: "/himalaya-3d/" + "cesium/" = "/himalaya-3d/cesium/"
```

Both the copy destination and `CESIUM_BASE_URL` start from the same `base`, so the base path
cannot get out of sync. The folder name `cesium` is still typed in two places (`dest: 'cesium'` in
`vite.config.ts` and `'cesium/'` in `cesiumSetup.ts`), so each line has a comment pointing at the
other, and the smoke test fails if any file 404s. A mismatch is caught before deploy.

### `CesiumGlobe.tsx` — React + Cesium lifecycle

1. React renders an empty `<div ref={containerRef}>`.
2. `useEffect` runs after the div is on the page and creates `new Viewer(container, options)`.
3. The effect returns a cleanup function that calls `viewer.destroy()`.

Why the cleanup matters: each Viewer holds a **WebGL context** (a connection to the GPU).
Browsers allow only a small number at once. In development React's StrictMode mounts, unmounts
and remounts components on purpose to expose missing cleanups — without `destroy()` we would
leak a context every time.

`buildViewerOptions()` picks the data sources: **with a token**, Cesium World Terrain + ion
imagery; **without**, the low-resolution NaturalEarthII image bundled in the cesium package and
no terrain. Why: CI runs tests without secrets, and a new teammate without a token still sees a
working app plus a clear notice.

## Key concepts from first principles

- **Static site**: just files; the server does no computation. → Free hosting, but no secrets.
- **Environment variables in Vite**: only names starting with `VITE_` are exposed to browser
  code via `import.meta.env`. They are inserted *at build time*, so the value ends up in the JS.
- **WebGL**: the browser API that lets JavaScript draw with the GPU. Cesium is built on it.
  On CI machines without a GPU, Chromium uses *SwiftShader* (a software GPU) — that is why the
  Playwright config passes `--use-angle=swiftshader`.
- **Terrain vs imagery**: terrain is the 3D *shape* (heights); imagery is the *picture* draped on it.

## Likely viva questions (M0 part — more added with each feature)

1. **Why does the site need `base: '/himalaya-3d/'`?** — Pages serves from a sub-path; without it
   every asset URL points at the domain root and 404s.
2. **What is `CESIUM_BASE_URL` and what happens if it is wrong?** — The folder Cesium loads its
   workers/assets from; if wrong, workers 404 and terrain/imagery never appear.
3. **Why create the Viewer in `useEffect` and not during render?** — Render must be pure and the
   div does not exist yet; effects run after the DOM is ready and give us a cleanup hook.
4. **What does `viewer.destroy()` free?** — The WebGL context and GPU memory, the widget DOM
   elements and its event handlers.
5. **Is the Cesium token secret?** — No; it is in the built JS. It is protected by restricting
   its Allowed URLs to our Pages domain on cesium.com.
6. **How does the app behave with no token?** — Offline imagery, no terrain, visible notice.
7. **How do you know the deploy works?** — The e2e test serves the production build under the
   same sub-path and fails on any 404; then the deploy workflow publishes the same build.
8. **What is `requestRenderMode` and why will you turn it on?** — Cesium only redraws when
   something changes instead of 60 times a second → less CPU/GPU, better battery (M3/M7).
9. **What was hard in setup?** — Making Cesium's runtime files work under two different base paths.
10. **What would you improve?** — Split Cesium into its own cached chunk; measure load time (#30).

## Prove you understand it (do these by hand, no AI)

1. Temporarily change `'cesium/'` to `'cesium-wrong/'` in `cesiumSetup.ts`, run `npm run e2e`,
   read the failure, explain it, then revert.
2. Add `requestRenderMode: true` to the Viewer options and explain when you must now call
   `viewer.scene.requestRender()`.
3. Without looking, draw the sequence: React render → effect → `new Viewer` → unmount → cleanup.
4. Explain to a teammate why `navigationInstructionsInitiallyVisible: false` does not remove the
   help button.

## Changelog

- 2026-11-19 — M0: base path, Cesium static files, Viewer lifecycle, smoke test.
