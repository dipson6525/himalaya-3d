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
| `app/src/engine/ViewerContext.ts` | Shares the Viewer with layers inside the globe (`useViewer`) | FR2 |
| `app/src/features/routes/RouteLayer.tsx` | Draws the trail and stop markers; removes them in cleanup | FR2 |
| `app/src/features/routes/routeEntities.ts` (+ test) | What to draw, as plain data; escaped popup HTML | FR2 |
| `app/src/features/routes/loadRoutes.ts`, `useRoutes.ts` | Download the index and the shown route | FR2 |
| `app/e2e/routes.spec.ts`, `app/e2e/fixtures/` | e2e with a SYNTHETIC route served by `page.route` | FR2 |
| `app/src/lib/geo/distance.ts` | Haversine, cumulative distance, distance → (segment, t) lookup | FR3, FR4 |
| `app/src/lib/geo/distance.test.ts` | Hand-checkable tests (1° = 111,194.9 m, πR/2, πR, uneven spacing) | FR3, FR4 |
| `app/src/lib/geo/stages.ts` (+ test) | Put stops on the trail, cut the trail into daily stages | FR2 |
| `app/src/features/routes/StageLayer.tsx` | Highlights the chosen day's stage; flies the camera to it | FR2 |
| `app/e2e/stages.spec.ts`, `app/e2e/serveFixtures.ts` | e2e: day buttons, highlight, clearing; shared fixture server | FR2 |
| `app/src/engine/flythrough/path.ts` (+ test) | Flythrough maths: resampling, safe heights, spline, distance table, camera pose, smoothing | FR3 |
| `app/src/engine/flythrough/FlythroughController.ts` | Plays / pauses the flythrough; moves the camera every frame | FR3 |
| `app/src/engine/flythrough/FlythroughLayer.tsx`, `features/routes/FlythroughControls.tsx` | One controller per route; the Play / Pause button | FR3 |
| `app/e2e/flythrough.spec.ts` | e2e: play, pause, resume, pause on day, stop on another trek | FR3 |
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
CesiumGlobe.tsx: new Viewer(...)
   ├─ viewNepal(viewer)                 camera.setView to NEPAL_START_VIEW
   ├─ addMapDataCredits(viewer)         "© OpenStreetMap contributors" on screen
   └─ makeHomeButtonShowNepal(viewer)   house button → fly back to the start view
cleanup: remove the home-button listener, then viewer.destroy()
```

**Why split `nepalView.ts` (numbers) from `camera.ts` (Cesium calls)?** Importing Cesium in a
unit test needs a browser; plain numbers do not. So the part worth testing — "does the camera
look at Nepal?" — lives in a file with no Cesium import and is tested with Vitest in Node.

**The start view.** 450 km up at 84.1 °E, 22.8 °N (south of Nepal), heading 0° (north), pitch
−35°. A side view shows the height of the mountains; a top-down view flattens them.

**Where does the camera look? Two answers, both tested.**

*Flat-earth estimate (`lookAtPoint`).* Height h, looking down at angle |pitch|: on flat ground the
line of sight lands d = h / tan(|pitch|) away. Our numbers: d = 450 km / tan 35° = 450 / 0.700 ≈
642.7 km north. One degree of latitude = 2π × 6,371 km / 360 ≈ 111.19 km, so 642.7 / 111.19 ≈
5.78° → 22.8° + 5.78° ≈ **28.58 °N**.

*Exact, on a round Earth (`lookAtPointOnSphere`).* The real ground curves AWAY below a flat plane
(by about d² / 2R ≈ 32 km over 640 km), so the line of sight travels **farther** before it meets
the ground. Put the Earth's centre at (0, 0) and the camera at (0, H) with H = R + h = 6,821 km.
After travelling s along the ray the point is (s cos α, H − s sin α); it is on the ground when its
distance from the centre is R:

    s² − 2Hs·sin α + (H² − R²) = 0  →  s = H sin α − √(H² sin²α − (H² − R²))

With α = 35°: H sin α ≈ 3,912.4 km, H² − R² = 5,936,400 km², √(...) ≈ 3,061.1 km → s ≈ 851.3 km
along the ray. The angle at the centre is δ = atan2(s cos α, H − s sin α) ≈ 0.10967 rad, so the
ground distance is R·δ ≈ **698.7 km** and the aim point is 22.8° + 6.28° ≈ **29.08 °N**. If the
square root's inside is negative, the ray misses the Earth (the camera looks past the horizon) and
the function throws. Both functions also refuse a pitch of 0° or more (not looking down).

**How the view was chosen.** By screenshots of the real build: a camera 0.5° further north (exact
aim about 29.58 °N) showed mostly the Tibetan plateau; this view centres Nepal's hills and the
Himalayan crest (`docs/screenshots/m3-nepal-start-view.png`, ADR-023).

**The home button.** Cesium's house button normally flies to the whole Earth. Its command raises
`beforeExecute` first; our listener sets `info.cancel = true` (Cesium then skips its own flight)
and calls `viewNepal(viewer, 1.5)` to fly back over 1.5 s. The listener is removed in cleanup.

**Request-render mode.** Normally Cesium draws about 60 frames a second even when nothing moves.
With `requestRenderMode: true` it draws only when something changes (camera, tiles, entities).
`maximumRenderTimeChange: Infinity` says time passing alone is no reason to redraw. Anything that
changes the scene behind Cesium's back must call `viewer.scene.requestRender()`. Cesium notices
some changes by itself: every frame it checks whether the camera moved (so `setView`, `flyTo` and
mouse dragging need no help), and tile loads and window resizes ask for a frame too. The credit
area only updates when a frame is drawn, so the live layers must call `requestRender()` after
adding a credit. How much the mode helps is measured by the team (#29), not assumed.

**Credits.** `new Credit(html, true)`: the `true` means "show on screen"; otherwise the credit
appears only inside Cesium's "Data attribution" pop-up. The text comes from the i18n files
(`credits.osm`, English in both for now). The e2e test checks the OSM credit text is in the
on-screen credit area.

### Geo maths for the flythrough (`app/src/lib/geo/distance.ts`, issue #18)

**What it is for.** The flythrough (#19) must move the camera at the same ground speed whatever
the spacing of the trail's points, and the elevation profile (#21) needs "distance along the
trail" for its x-axis. Both start from these pure functions (no Cesium, tested in Node).

**Data flow.**

```
trail points [lon, lat] ──cumulativeDistancesM──► [0, d₀₁, d₀₁+d₁₂, ...]   (metres)
"travelled s metres" + table ──locateDistance──► { segment i, t in [0, 1] }  (binary search)
{ i, t } ──pointOnSegment──► [lon, lat] = p_i + t·(p_{i+1} − p_i)
```

**Haversine (proposal equation 3.2).** With φ = latitude, λ = longitude in radians, R = 6,371 km:

    a = sin²(Δφ/2) + cos φ₁ · cos φ₂ · sin²(Δλ/2)
    d = 2R · asin(√a)

Worked example: one degree along the equator. Δφ = 0, Δλ = 1° = 0.0174533 rad, cos φ = 1,
a = sin²(0.0087266) = 0.0000761524, √a = 0.0087265 (= sin 0.5°), so asin(√a) = 0.5° = 0.0087266
rad and d = 2 × 6,371,000 × 0.0087266 ≈ **111,194.9 m**, which is 2πR / 360 as it should be.
Calculator trap: asin of the *rounded* 0.0087266 gives 111,195.7 m — keep the digits. Why not Pythagoras on degrees? A degree of longitude is
111.19 km × cos(latitude) long (about 98.2 km at 28 °N), so degrees are not the same length in
every direction. `Math.min(1, a)` guards against rounding pushing a a hair above 1 (asin would give
NaN; a safety net — in testing it never went above 1, so no test can prove the guard).

**Cumulative distance and constant speed.** If the camera moved "one point per frame", it would
rush along stretches where OSM has few points and crawl where it has many. Instead the flythrough
keeps a distance s that grows by speed × time each frame, and asks "which segment contains s?".

**Binary search (`locateDistance`).** The table is sorted (distances only grow), so we keep a
range [low, high] with table[low] ≤ s < table[high] and halve it each step: about log₂ n steps,
14 for 10,000 points, instead of up to 10,000. Then t = (s − table[i]) / (table[i+1] − table[i]).
Distances before the start or after the end are clamped. Example from the tests: segments of 1°,
3° and 1°; half-way (2.5°) is in the long middle segment at t = (2.5 − 1) / 3 = 0.5.

**Limits.**
- The Earth is treated as a sphere: against the real WGS84 ellipsoid the error is at most about
  0.56% (about 0.34% north–south at 28 °N), figures computed in code review; TODO(team): confirm
  with a published source for the report.
- `locateDistance` refuses a distance that is not a finite number, so a NaN can never reach Cesium.
- `pointOnSegment` interpolates lon/lat in a straight line; fine for trail segments of metres to
  hundreds of metres, not for continents.
- Heights are ignored: these are map distances, not the distance walked up and down hills.

### Drawing a route (`features/routes/`, `engine/ViewerContext.ts`, issue #15)

**Data flow.**

```
App ──useRoutes──► fetch <base>data/routes/index.json ──► fetch <first id>.geojson ──► RouteFile
App renders <CesiumGlobe> <RouteLayer route=... language=... /> </CesiumGlobe>
CesiumGlobe ──ViewerContext──► RouteLayer ──useViewer()──► the Viewer (null until it exists)
RouteLayer DRAW effect [viewer, route, language]:
     routeDrawing(route, language)                       plain data, unit-tested
     → new CustomDataSource: trail polyline + one point/label per stop
     → viewer.dataSources.add(...)  (finishes a moment later: a Promise)
        └ when it finishes: if already cleaned up → remove it again; else onDrawn(stop count)
     cleanup: viewer.dataSources.remove(dataSource)       (every entity gone at once)
RouteLayer FLY effect [viewer, route]:  camera.flyToBoundingSphere(sphere around the trail)
```

**Key ideas.**
- *Load at run time, not bundle:* the index is small; a route file is downloaded only when shown,
  and the e2e test can swap in a synthetic route with `page.route` (ADR-025).
- *One data source per route:* removing it removes the trail and every marker together, so
  switching routes can never leave old markers behind.
- *`clampToGround: true`* drapes the trail over the terrain; *`HeightReference.CLAMP_TO_GROUND`*
  puts the markers on the ground; *`disableDepthTestDistance: Infinity`* keeps markers visible
  even where a ridge is in front of them.
- *Popups:* each stop entity has a `description` (HTML) that Cesium's info box shows when the
  marker is clicked. The HTML is built in `routeEntities.ts` and every piece of data in it goes
  through `escapeHtml`, so a "<" in a name can never inject markup.
- *Async safety (found in code review):* `dataSources.add` only really adds the data source a
  moment later. React StrictMode runs effect → cleanup → effect straight away, so the cleanup's
  `remove()` can run BEFORE the add finished — and then it removes nothing, and the old markers
  would stay twice. So when the add finishes, the code checks the `removed` flag and removes the
  data source itself. `isDestroyed()` guards the case where the whole globe is already gone.
- *Two effects:* the DRAW effect re-runs when the language changes (labels and popups must
  change); the FLY effect runs only when the route changes, so switching language does not throw
  the user's view away.
- *Checked before rendering:* `useRoutes` runs `routeDrawing` on a downloaded file inside its
  `try`, so a file with the wrong shape shows "could not load" instead of crashing the page (and
  the medical disclaimer with it).

**Limits.** The first route is shown automatically at start-up; since #16 the user can choose
another in the Trek tab (Dipson's `TrekPanel`). Daily stages: see the next section (#49). The
info box is Cesium's own; its styling is basic.

### Daily stages (`lib/geo/stages.ts`, `StageLayer.tsx`, issue #49)

**The problem.** The route file has one trail line and the stops with their arrival day. FR2
also wants the *daily stages*: which part of the line is walked on which day.

**Step 1 — put each stop on the trail** (`nearestPointOnLine`). For every segment A→B:

```
flat map around A, in metres:  x = Δlon × 111,195 × cos(lat of A),  y = Δlat × 111,195
t = ((P − A) · (B − A)) / |B − A|²      → how far along AB the foot of the perpendicular is
t = clamp(t, 0, 1)                      → stay on the segment, not on the infinite line
nearest point Q = A + t (B − A);  offset = |P − Q|
```

The segment with the smallest offset wins, and the stop's distance along the trail is
`cumulative[i] + t × (length of segment i)`, using the haversine table from #18.

*Worked example (the unit test, on the equator, where cos 0° = 1 and 0.01° = 1,111.95 m):*
line (0, 0) → (0.01, 0) → (0.01, 0.01), an L. Stop P = (0.009, 0.002).
- Segment 1: B − A = (1,111.95, 0), P − A = (1,000.75, 222.39). t = 1,000.75 × 1,111.95 /
  1,111.95² = 0.9; Q = (1,000.75, 0); offset = 222.39 m.
- Segment 2: A = (0.01, 0), B − A = (0, 1,111.95), P − A = (−111.19, 222.39). t = 222.39 /
  1,111.95 = 0.2; offset = 111.19 m. **Smaller, so segment 2 wins.**
- Distance along = 1,111.95 + 0.2 × 1,111.95 = 1,334.34 m.

**Step 2 — stages.** Sort the stops by day. The stage that ends at stop k is the trail from
stop k−1 to stop k, walked on stop k's arrival day. Stops on days 1, 2, 4 give two stages,
"day 2" and "day 4"; day 3 is a rest day and has no stage. Length = |d_k − d_(k−1)|.

**Step 3 — cut the line** (`sliceLine`): the exact start point (from `locateDistance` +
`pointOnSegment`, #18), every original point in between, the exact end point. If the start is
further along than the end (the way back of an out-and-back trek), cut it the normal way and
reverse it.

**On the globe** (`StageLayer`): one yellow, 8 px, ground-clamped polyline in its own data
source, then the camera flies to it. *Drawing order lesson:* the first version used
`zIndex: 1` and the trail still covered the highlight, which only the screenshot showed.
`zIndex` orders lines inside ONE data source; data sources are drawn in their list order. So
the stage's data source is raised to the top, and `RouteLayer` lowers the trail's to the bottom
every time it redraws (ADR-027).

**Camera height (found in code review).** The trail has no heights, so the sphere the camera
flies to was at sea level. On a short stage high up (1.4 km near 4,900 m, measured with World
Terrain) the camera ended 13 m above the ground, facing a hillside. Now it aims at the higher of
the two stops' cited altitudes and stays at least 4 km away at 45°: height ≈ altitude + 4,000 ×
sin 45° ≈ altitude + 2,828 m. On the same test stage it ended about 3 km above the terrain.

**Limits.** Map distance along the simplified line: real walking is longer (slopes, small
zig-zags removed by Douglas–Peucker). If the trail passes the same place twice, a stop can land
on the wrong pass. The "jump to day N" of the flythrough (#20) will reuse these stages.

### The flythrough camera (`engine/flythrough/`, issue #19)

**Pipeline** (each step is one function in `path.ts`, with tests):

```
trail (uneven points)
  → resampleTrail: equal intervals of ≤ 100 m          e.g. 2,223.9 m → 23 × 96.7 m
  → sampleTerrain (once, level 11): ground height at each sample
  → safeHeights: highest ground within ±5 samples (±500 m) + 250 m
  → buildFlightPath: CatmullRomSpline(times = ground distance, points = ECEF x, y, z)
                     + distance table: spline sampled every 10 m of time, haversine added up
start:        s = 600 m (so the camera, 600 m behind s, is at the very start of the trail)
every frame:  s += 250 m/s × dt          (dt = seconds since the last frame, at most 0.1)
  → cameraPose(s): camera = point(s − 600) raised 300 m; looks at point(s + 800)
  → guard: at least 150 m above the terrain loaded under the camera
  → aim from where the camera really is: heading and pitch to the look-ahead point
  → smooth both: h += α · (shortest turn to target), p += α · (target − p), α = 1 − e^(−dt/1.5 s)
  → camera.setView(...) and scene.requestRender()
```

**Why a distance table for the curve (constant ground speed).** The spline's "time" is the
distance along the *trail*, but the camera flies along the *curve*, which cuts corners and eases
in at its ends. The unit test measured each 50 m step on the ground: without the table 37.5 to
62.5 m, with it 49 to 51 m. The table is the same idea as #18's cumulative distances, now for the
curve: sample it every 10 m, add up the haversine distances, and binary-search "s metres" in it.

**Heading smoothing, worked.** τ = 1.5 s and the target is 90° away. After one frame of 1/60 s,
α = 1 − e^(−0.0111) = 0.0110, so the camera turns 1.0°. After 1.5 s it has turned
1 − e^(−1) = 63.2% = 56.9° (the unit test checks this). The shorter way round: from 350° to 10° is
+20° (`wrapToPi`), so the camera turns through north, not all the way back through south.

**Heading and pitch from two points.** `Transforms.eastNorthUpToFixedFrame(camera)` is the
matrix from local east/north/up to ECEF; its inverse turns the target into (east, north, up)
metres. heading = atan2(east, north), pitch = atan2(up, √(east² + north²)). The camera is 300 m
higher than a point 1,400 m ahead: pitch = −atan(300 / 1400) ≈ −12°.

**Outside React.** The camera changes 60 times a second. `FlythroughController` is a plain
class with one `requestAnimationFrame` loop; React only keeps the controller and its status
(idle / preparing / playing / paused / finished / error), which changes a few times per flight.
The Play button calls `play()` / `pause()` ("commands are method calls"). `FlythroughLayer`
creates one controller per route and destroys it when the route changes.

**Who else moves the camera (found in code review).** The home button, following an entity
(double-click on a marker) and the day buttons all move the camera. A running flythrough would
undo them in the next frame (`setView` does not cancel their flights), so each of them pauses it.
The controller listens to `homeButton.viewModel.command.beforeExecute` and
`trackedEntityChanged`, and removes those listeners in `destroy()`.

**Missing terrain.** If a terrain tile fails, its heights come back undefined. Counting them as
0 m would fly into the mountains, so they count as the highest height found on the route.

**Testing the controller without a browser.** `FlythroughController.test.ts` gives it a stub
Viewer (a plain object with only what it uses), replaces `sampleTerrain`, and replaces
`requestAnimationFrame` with a list the test runs one frame at a time. A mutation run undid seven
fixes one by one; each made a test fail.

**Found while testing.** (1) Pressing Play while World Terrain was still loading failed: Cesium
leaves `terrainProvider` undefined until it is ready, so `play()` waits for
`globe.terrainProviderChanged` (up to 20 s). (2) The button was `disabled` while preparing, and a
disabled button loses keyboard focus, so a keyboard user's next Enter did nothing; it now uses
`aria-disabled` and ignores presses.

**Limits.** Terrain level 11 is coarse (a tile is 0.088°, about 9.8 km; Cesium World Terrain is
an irregular mesh, so the spacing of heights inside a tile varies, TODO(team): verify over Nepal):
the ±500 m maximum, the 250 m clearance and the runtime guard cover that. Speed and heights still
need checking on real treks, and the FPS on the team's laptops (#29). TODO(team): verify after
#9–#12.

### Flythrough controls (`FlythroughControls.tsx`, issue #20)

- **Speed** is a native select (0.5×, 1×, 2×, 4× of 250 m/s). It is a *value*, so it is
  `useState` in `App`, and an effect on [controller, speed] calls `controller.setSpeed()`. That
  same effect gives a new trek's controller the chosen speed. Compare Play: an *event*, so a
  method call (ui-design, "commands are method calls").
- **Jump to the start of day N** is one button per day that has a stage. Not a select: Chromium
  on Windows changes a closed select with the arrow keys, so a keyboard user would jump once per
  key press.
- **Trail distance → curve distance.** A stage starts at a distance along the TRAIL
  (`Stage.fromDistanceM`). The flythrough moves along the CURVE, which is shorter at corners. The
  spline's time IS the trail distance, so `curveDistanceForTrail` finds that time in
  `tableTimes` (binary search) and reads the curve distance next to it.
- **Where the camera lands.** `jumpTo` sets the current point to that curve distance + 600 m, so
  the camera (600 m behind) stands at the day's start stop and looks ahead. Playing → keeps
  playing; otherwise → "paused" there.
- **A jump also highlights the day** via StageLayer with `flyTo = false`, so the highlight does
  not fly the camera away while the flythrough moves it.
- **Found while refactoring.** Moving preparation into `ensurePath()` added one more `await`
  step, and two Play presses sharing one preparation could then both start a loop (camera at
  double speed). A controller unit test caught it; `play()` now stops if something already
  started playing.

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
    down: a side view shows the mountains' height; the exact aim point is about 29.08 °N.
12. **How do you know where it looks without opening a browser?** — `lookAtPointOnSphere` solves
    the ray–sphere equation; `nepalView.test.ts` checks the answer (and a loose box around Nepal).
    The screenshot confirmed it visually.
13. **Why do the flat and exact answers differ, and which way?** — The flat estimate ignores the
    Earth's curve. The ground drops away about 32 km over 640 km, so the real line of sight lands
    FARTHER: about 698.7 km instead of 642.7 km (29.08 °N instead of 28.58 °N).
14. **How does the home button come back to Nepal?** — A `beforeExecute` listener cancels Cesium's
    own flight and calls `viewNepal(viewer, 1.5)`; cleanup removes the listener.
15. **Why `new Credit(html, true)`?** — `true` = show on screen; otherwise the credit is only in the
    pop-up, and NFR5 needs credits visible on the map.
16. **Why is there no `requestRender()` after moving the camera?** — Cesium checks every frame
    whether the camera moved and redraws if it did, even in request-render mode. An earlier draft
    had the call with a wrong comment; the code review caught it.
17. **Which parts did the AI tool write, and how did you check them?** — See "AI use in this
    part"; answer in your own words after doing the exercises.
18. **Write the haversine formula and say what each symbol is.** — a = sin²(Δφ/2) + cos φ₁ cos φ₂
    sin²(Δλ/2), d = 2R asin(√a); φ latitude, λ longitude, both in radians; R = 6,371 km.
19. **Why not Pythagoras on latitude and longitude?** — A degree of longitude is 111.19 km × cos φ
    long, so degrees are not the same length in every direction (98.2 km at 28 °N).
20. **How does the flythrough keep a constant speed with uneven points?** — It keeps a distance s
    that grows by speed × time, and finds the segment containing s in the cumulative table.
21. **Why binary search?** — The table is sorted; halving the range each step needs about log₂ n
    steps (14 for 10,000 points) instead of up to n.
22. **What does locateDistance return at exactly a stop's distance, and past the end?** — The start
    of the next segment (t = 0); past the end it is clamped to the last segment with t = 1.
23. **How do layers get the Cesium Viewer?** — Through `ViewerContext`: CesiumGlobe provides it,
    layers call `useViewer()` and must handle null.
24. **How are old markers removed when the route changes?** — Everything is in one
    `CustomDataSource`; the cleanup calls `dataSources.remove(dataSource)`, and if the add had not
    finished yet, the add's own callback removes it (StrictMode case).
25. **Why escape the popup HTML when the data is ours?** — Cheap insurance: a `<` or `&` in a name
    can never break the popup or inject markup.
26. **How can the route be tested before real data exists?** — The e2e test intercepts the two
    requests and serves a synthetic fixture; the screenshot is named `...-synthetic.png`.
27. **How do you find where a stop is on the trail?** — Project it onto every segment (t clamped
    to 0…1), keep the nearest, and add t × segment length to the cumulative distance.
28. **Why clamp t?** — Without it the foot of the perpendicular can lie on the infinite line
    beyond A or B, i.e. off the trail.
29. **Why a flat map, when distances use haversine?** — Projection needs straight-line geometry;
    over a trail segment (metres to a few hundred metres) the flat map is accurate enough. Lengths
    still come from the haversine table.
30. **Is "7.4 km" the walking distance?** — No: it is the map distance along the simplified
    trail. Slopes and removed zig-zags make the real walk longer; the UI says "along the trail".
31. **How are rest days and out-and-back treks handled?** — A rest day is a gap in the day
    numbers, so it has no stage. On the way back the distance decreases; the length uses the
    absolute difference and the piece of line is reversed.
32. **Why was the highlight hidden at first, and how was it fixed?** — `zIndex` only orders
    lines within one data source; the trail's data source was drawn later. Fixed by raising the
    stage's data source to the top and keeping the trail's at the bottom.
33. **Where does the camera fly for a stage, and why not just use the trail points?** — The trail
    points have no height (sea level). Aiming there on a high, short stage leaves the camera on
    the ground. It aims at the higher stop's cited altitude, 4 km away at 45° or more.
34. **A route file is broken. Why does the page not go blank?** — `useRoutes` runs both
    `routeDrawing` and `routeStages` on the file inside `try` before using it; if either throws,
    the status says "could not load" and the disclaimer stays.
35. **How does the flythrough keep a constant ground speed?** — s grows by speed × dt each
    frame, and a distance table for the curve (spline sampled every 10 m, haversine summed) turns
    s into spline time by binary search. Without it, steps were 37.5–62.5 m instead of 50 m.
36. **Why Catmull-Rom and not another spline?** — It passes through every control point, so the
    camera really goes over each sample; and Cesium has it built in.
37. **What does τ = 1.5 s mean?** — After 1.5 s the heading has turned 63% of the way to a new
    direction; α = 1 − e^(−dt/τ) gives the same motion at any frame rate.
38. **How is the camera kept out of the mountains?** — Flight height = highest terrain within
    ±500 m + 250 m, the camera another 300 m above, and a guard each frame lifts it to 150 m
    above the terrain loaded under it.
39. **Why is the controller not React state?** — It changes the camera 60 times a second; React
    state would re-render the page every frame. React only keeps its status.
40. **Why aria-disabled and not disabled on the Play button?** — A disabled button loses keyboard
    focus; the user's next Enter (to pause) would do nothing.
41. **What happens if the user presses the home button during a flythrough?** — The controller
    hears the button's `beforeExecute` event and pauses, so the home flight is not undone.
42. **How do you test code that runs every animation frame?** — Replace `requestAnimationFrame`
    with a list and run the frames by hand with chosen timestamps; use a stub Viewer.
43. **Why is speed state but Play a method call?** — Speed is a value the screen shows and a new
    controller must get; Play is an event that must happen once per press.
44. **Why buttons for the days and not a select?** — A closed select changes with the arrow keys
    on Windows; acting on every change would jump once per key press.
45. **The stage starts 7,431 m along the trail. Where does the flythrough jump to?** — The curve
    distance at trail time 7,431 m (`curveDistanceForTrail`), plus 600 m, so the camera stands at
    the start stop and looks ahead.
46. **Why does a jump highlight the stage without flying there?** — The flythrough is moving the
    camera; a fly-to would fight it. The stop list's day buttons do fly there, and pause first.

## Prove you understand it (do these by hand, no AI)

1. Temporarily change `'cesium/'` to `'cesium-wrong/'` in `cesiumSetup.ts`, run `npm run e2e`,
   read the failure, explain it, then revert.
2. Measure what request-render mode does: open the app, leave it still for a minute and note
   the GPU use in Windows Task Manager; then set `requestRenderMode: false`, rebuild, and measure
   again. Explain the difference, then change it back.
3. Without looking, draw the sequence: React render → effect → `new Viewer` → unmount → cleanup.
4. Explain to a teammate why `navigationInstructionsInitiallyVisible: false` does not remove the
   help button.
5. Work out by hand where the camera would look with pitch −25° instead of −35°, with the flat
   formula and then the exact one. Add a test case for it in `nepalView.test.ts`. Is the aim point
   still inside the box around Nepal? Which answer is farther, and why?
6. Change the start view to face north-east (heading 45°) and use `lookAtPoint` to predict which
   way the aim point moves; check with a screenshot (`UPDATE_SCREENSHOTS=1 npm run e2e`), then revert.
7. Compute the haversine distance between [85, 27] and [85, 28] by hand (show a and √a), then
   check it with a new test. Why is it the same as one degree along the equator?
8. Add a test where the route has a single very long segment between many short ones, and check
   that equal steps in distance still give equal steps on the ground.
9. Change the trail colour and width in `RouteLayer.tsx`, rebuild, and take a screenshot with
   `UPDATE_SCREENSHOTS=1 npm run e2e`. Then revert.
10. Explain, with the code open, what happens if the route changes while `dataSources.add` is
    still pending. Which lines make sure the old route's markers are removed anyway?
11. Redo the L-shaped worked example above for the stop (0.004, −0.001): which segment wins,
    what is t, and what is the distance along? Add it as a test.
12. In `RouteLayer.tsx`, remove the `lowerToBottom` line, take a screenshot with a stage pressed
    (`UPDATE_SCREENSHOTS=1 npx playwright test e2e/stages.spec.ts`), and explain what you see.
    Then revert.
13. Draw an out-and-back trek on paper (up on days 2–3, down on days 4–5) and work out each
    stage's start, end and direction before checking with `splitIntoStages`.
14. With τ = 1.5 s and frames of 1/30 s, work out by hand how far the heading turns towards a
    target 60° away in the first frame and after 3 s. Check with a new `smoothAngle` test.
15. In `path.ts`, make `pointAt` use the spline time directly (`spline.evaluate(s)`), run
    `npx vitest run src/engine/flythrough`, and explain why the constant-speed test fails. Revert.
16. Change `HEADING_TAU_S` to 0.1 and then to 5, play the flythrough on the synthetic route
    (`npm run dev` with the e2e fixtures, or a real route later) and describe the difference.
17. On the L-shaped test path in `path.test.ts`, work out by hand roughly what
    `curveDistanceForTrail(path, 2000)` should be compared with 2,000, and why it is smaller.
    Then add it as a test.

## AI use in this part

- **Issue #14 (2026-11-21):** Claude Code wrote `nepalView.ts` (+ test), `camera.ts`,
  `credits.ts`, the `CesiumGlobe.tsx` changes, the e2e credit check, ADR-023 and this section. It
  chose the start view by comparing two screenshots from the real build, and ESLint caught a
  hook-naming mistake that was fixed. A code-reviewer subagent then found real errors: the notes had the Earth's curvature the wrong way round, the cos(latitude) term was untested, a pitch of 0° or more was not rejected, a comment about `requestRender()` was wrong, and the credit text was hard-coded. All were fixed and `lookAtPointOnSphere` (exact) was added, with tests.
- **Issue #18 (2026-11-21):** Claude Code wrote `distance.ts` and its tests. A code-reviewer
  subagent found that the worked example did not reproduce on a calculator (rounding), that the
  last segment and latitude interpolation were untested, and that a NaN distance slipped through;
  all fixed, and a mutation check then caught five deliberate bugs.
- **Issue #49 (2026-11-22):** Claude Code wrote `stages.ts` (+ test), `StageLayer.tsx`, the
  day buttons, `stages.spec.ts`, ADR-027 and this section. The first highlight was drawn under
  the trail; this was found by looking at the screenshot and fixed. A unit test caught a
  duplicated end point in `sliceLine`, also fixed. A code-reviewer subagent then found the
  sea-level camera aim and a crash path for malformed files; both fixed, the camera fix measured
  with World Terrain on a temporary test stage.
- **Issue #19 (2026-11-22):** Claude Code wrote `path.ts` (+ test), `FlythroughController.ts`,
  `FlythroughLayer.tsx`, `FlythroughControls.tsx`, the e2e test, ADR-028 and this section. The
  tests found uneven speed (fixed with the curve's distance table), a terrain-loading race and a
  keyboard-focus bug; all fixed. A code-reviewer subagent then found the home button being undone
  and smaller lifecycle problems; all fixed, with controller unit tests. Mutation checks confirmed
  the tests catch them.
- **Issue #20 (2026-11-23):** Claude Code wrote `setSpeed`, `jumpTo`, `ensurePath`,
  `curveDistanceForTrail`, the Speed and day controls, their tests, ADR-029 and this section. A
  controller unit test caught a double animation loop during the refactor.
- **What you must still do:** read the engine files, run the tests and the app yourself, and do
  exercises 2, 5–8 and 11–17 by hand.

## Changelog

- 2026-11-19 — M0: base path, Cesium static files, Viewer lifecycle, smoke test.
- 2026-11-21 — M3 #14: start view, `lookAtPoint` worked example, home button, request-render
  mode, credits; questions 8–17 (Q9 now left for you to answer); exercises 2, 5, 6; AI use.
- 2026-11-21 — after code review: exact round-Earth aim point (29.08 °N, farther than the flat
  28.58 °N), corrected curvature direction and render-mode notes, Q11–Q13 and Q16 rewritten.
- 2026-11-21 — M4 #18: geo maths walkthrough (haversine with a calculator-safe worked example,
  cumulative distance, binary search), limits, questions 18–22, exercises 7–8.
- 2026-11-21 — M3 #15: route drawing walkthrough (ViewerContext, data source, popups, async
  safety), Q23–26, exercises 9–10.
- 2026-11-22 — M3 #49: daily stages walkthrough (projection worked example, stages, slicing,
  drawing order), Q27–32, exercises 11–13, AI use. After code review: camera height, Q33–34.
- 2026-11-22 — M4 #19: flythrough walkthrough (pipeline, distance table, smoothing worked
  example, heading/pitch, outside React, testing finds), Q35–40, exercises 14–16, AI use.
  After code review: other camera movers pause it, missing terrain, controller tests, Q41–42.
- 2026-11-23 — M4 #20: flythrough controls (speed as a value, day buttons, trail → curve
  distance, jump landing point), Q43–46, exercise 17, AI use.
