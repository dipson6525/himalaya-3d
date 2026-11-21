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
| `app/src/engine/CesiumGlobe.tsx` | Creates/destroys the one Cesium Viewer; offline fallback without a token; request-render mode | FR1 |
| `app/src/engine/nepalView.ts` | The start view as plain numbers + `lookAtPoint` maths (no Cesium) | FR1 |
| `app/src/engine/nepalView.test.ts` | Checks the start view looks at Nepal (worked numbers in comments) | FR1 |
| `app/src/engine/camera.ts` | Nepal as Cesium's default view; `viewNepal`; home button flies back to Nepal | FR1 |
| `app/src/engine/credits.ts` | OpenStreetMap credit shown on the map next to Cesium's | NFR5 |
| `app/playwright.config.ts` | Runs e2e tests against the production build under `/himalaya-3d/` | all |
| `app/e2e/smoke.spec.ts` | Smoke test: app loads, canvas renders, credits + disclaimer, no 404s | FR1, NFR5–6 |
| `.github/workflows/deploy.yml` | Builds with the token secret and publishes to Pages | NFR7 |

Coming next: route lines and stop markers (#15), `app/src/lib/geo/` (haversine, cumulative
distance — #18), flythrough (#19, #20).

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

### The start view over Nepal (`nepalView.ts`, `camera.ts`, issue #14)

**What happens at start-up.**

```
cesiumSetup.ts ──setNepalAsDefaultView──► Camera.DEFAULT_VIEW_RECTANGLE = Nepal (before any Viewer)
CesiumGlobe.tsx: new Viewer(...)
   ├─ viewNepal(viewer)                 camera.setView to NEPAL_START_VIEW, then requestRender()
   ├─ addMapDataCredits(viewer)         "© OpenStreetMap contributors" on screen
   └─ makeHomeButtonShowNepal(viewer)   house button → fly back to the start view
cleanup: remove the home-button listener, then viewer.destroy()
```

**Why split `nepalView.ts` (numbers) from `camera.ts` (Cesium calls)?** Importing Cesium in a
unit test needs a browser; plain numbers do not. So the part worth testing — "does the camera
look at Nepal?" — lives in a file with no Cesium import and is tested with Vitest in Node.

**The start view.** 450 km up at 84.1 °E, 22.8 °N (south of Nepal), heading 0° (north), pitch
−35°. A side view shows the height of the mountains; a top-down view flattens them.

**`lookAtPoint` (flat-earth approximation).** Where does the line of sight hit the ground?
Height h, looking down at angle |pitch|: the horizontal distance is d = h / tan(|pitch|).
Worked example with our numbers: d = 450 km / tan 35° = 450 / 0.700 ≈ 642.7 km north.
One degree of latitude = 2π × 6,371 km / 360 ≈ 111.19 km, so 642.7 / 111.19 ≈ 5.78° →
22.8° + 5.78° ≈ **28.58 °N**, inside Nepal (26.3–30.5 °N). The test checks exactly this.
Limit: the real Earth curves away (about d² / 2R ≈ 32 km over 640 km), so the true point is a
little nearer; good enough to check the view, never used to place data.

**How the view was chosen.** The first try aimed at 29.08 °N and the screenshot showed mostly the
Tibetan plateau; moving the camera 0.5° south centred Nepal's hills and mountains
(`docs/screenshots/m3-nepal-start-view.png`, ADR-023).

**The home button.** Cesium's house button normally flies to the whole Earth. Its command raises
`beforeExecute` first; our listener sets `info.cancel = true` (Cesium then skips its own flight)
and calls `viewNepal(viewer, 1.5)` to fly back over 1.5 s. The listener is removed in cleanup.

**Request-render mode.** Normally Cesium draws about 60 frames a second even when nothing moves.
With `requestRenderMode: true` it draws only when something changes (camera, tiles, entities).
`maximumRenderTimeChange: Infinity` says time passing alone is no reason to redraw. Anything that
changes the scene behind Cesium's back must call `viewer.scene.requestRender()` — `viewNepal`
does. How much this helps is measured by the team with the FPS overlay (#29), not assumed.

**Credits.** `new Credit(html, true)`: the `true` means "show on screen"; otherwise the credit
appears only inside Cesium's "Data attribution" pop-up. The e2e test checks the OSM credit text
is in the on-screen credit area.

## Key concepts from first principles

- **Static site**: just files; the server does no computation. → Free hosting, but no secrets.
- **Environment variables in Vite**: only names starting with `VITE_` are exposed to browser
  code via `import.meta.env`. They are inserted *at build time*, so the value ends up in the JS.
- **WebGL**: the browser API that lets JavaScript draw with the GPU. Cesium is built on it.
  On CI machines without a GPU, Chromium uses *SwiftShader* (a software GPU) — that is why the
  Playwright config passes `--use-angle=swiftshader`.
- **Terrain vs imagery**: terrain is the 3D *shape* (heights); imagery is the *picture* draped on it.
- **Heading and pitch**: heading = compass direction the camera faces (0° north, 90° east);
  pitch = up/down (0° level with the horizon, −90° straight down). Cesium wants radians:
  radians = degrees × π / 180, done by `CesiumMath.toRadians`.
- **Why lines of longitude need cos(latitude)**: meridians meet at the poles, so one degree of
  longitude is 111.19 km × cos(latitude) wide; at 28 °N that is about 98.2 km.

## Likely viva questions

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
8. **What is `requestRenderMode` and why is it on?** — Cesium only redraws when something
   changes instead of about 60 times a second, so the GPU rests while the user just looks. The
   cost: code that changes the scene without Cesium noticing must call `scene.requestRender()`.
9. **What was hard?** — TODO(Sparsh): answer from your own experience.
10. **What would you improve?** — Split Cesium into its own cached chunk; measure load time (#30);
    pick the start view for the screen's shape (a phone in portrait would crop Nepal's edges).
11. **Where does the camera start and why there?** — 450 km up, south of Nepal, facing north, 35°
    down: a side view shows the mountains' height; the aim point is about 28.6 °N, inside Nepal.
12. **How do you know it looks at Nepal without opening a browser?** — `lookAtPoint` computes the
    aim point with d = h / tan(|pitch|); `nepalView.test.ts` checks it is inside Nepal's box.
13. **Why is `lookAtPoint` only approximate?** — It treats the Earth as flat; over 640 km the curve
    drops about 32 km, so the true aim point is a little nearer. Fine for a check, not for data.
14. **How does the home button come back to Nepal?** — A `beforeExecute` listener cancels Cesium's
    own flight and calls `viewNepal(viewer, 1.5)`; cleanup removes the listener.
15. **Why `new Credit(html, true)`?** — `true` = show on screen; otherwise the credit is only in the
    pop-up, and NFR5 needs credits visible on the map.
16. **Why is `setNepalAsDefaultView` not called `useNepalAsDefaultView`?** — In React, names that
    start with `use` are hooks; ESLint's rules-of-hooks reported calling it at the top level. It
    is a plain function, so the name now says what it does.
17. **Which parts did the AI tool write, and how did you check them?** — See "AI use in this
    part"; answer in your own words after doing the exercises.

## Prove you understand it (do these by hand, no AI)

1. Temporarily change `'cesium/'` to `'cesium-wrong/'` in `cesiumSetup.ts`, run `npm run e2e`,
   read the failure, explain it, then revert.
2. Remove the `viewer.scene.requestRender()` line from `viewNepal`, rebuild, and press the home
   button. Describe what you see (or don't), explain why, then put the line back.
3. Without looking, draw the sequence: React render → effect → `new Viewer` → unmount → cleanup.
4. Explain to a teammate why `navigationInstructionsInitiallyVisible: false` does not remove the
   help button.
5. Work out by hand where the camera would look with pitch −25° instead of −35°, then add a test
   case for it in `nepalView.test.ts`. Is the aim point still inside Nepal?
6. Change the start view to face north-east (heading 45°) and use `lookAtPoint` to predict which
   way the aim point moves; check with a screenshot (`UPDATE_SCREENSHOTS=1 npm run e2e`), then revert.

## AI use in this part

- **Issue #14 (2026-11-21):** Claude Code wrote `nepalView.ts` (+ test), `camera.ts`,
  `credits.ts`, the `CesiumGlobe.tsx` changes, the e2e credit check, ADR-023 and this section. It
  chose the start view by comparing two screenshots from the real build, and ESLint caught a
  hook-naming mistake that was fixed. A code-reviewer subagent reviewed the change before merging.
- **What you must still do:** read the four engine files, run the tests and the app yourself,
  and do exercises 2, 5 and 6 by hand.

## Changelog

- 2026-11-19 — M0: base path, Cesium static files, Viewer lifecycle, smoke test.
- 2026-11-21 — M3 #14: start view, `lookAtPoint` worked example, home button, request-render
  mode, credits; questions 8–17 (Q9 now left for you to answer); exercises 2, 5, 6; AI use.
