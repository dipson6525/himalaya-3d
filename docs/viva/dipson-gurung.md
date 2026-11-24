# Viva notes — Dipson Gurung (041055-25)

Areas: UI (`app/src/ui/`), translations (`app/src/i18n/`), elevation profile, live layers
(earthquakes, weather), sun slider, documentation (`docs/`). Labels: `area:ui`, `area:i18n`,
`area:elevation`, `area:live-layers`, `area:docs`.

## Your part in one paragraph

You own what the user reads and touches: the page layout, every piece of text in two languages,
and the panels that show data — the elevation profile (M4), live earthquake and weather layers
and the sun-position slider (M6). You also keep the documentation current. In M0 that is the
layout with an always-visible medical disclaimer, a tiny translation helper with a test that
keeps English and Nepali in sync, and the requirements and architecture documents.

## File map (so far)

| File | Purpose | FR |
| --- | --- | --- |
| `app/src/ui/App.tsx` | Page layout: header, globe, side panel, disclaimer footer | all, NFR6 |
| `app/src/ui/styles.css` | CSS grid layout; stacks to one column below 900 px | NFR4 |
| `app/src/main.tsx` | Entry point: loads Cesium setup + CSS, renders `<App/>` | all |
| `app/src/i18n/index.ts` | `t(key, language)` translation helper | FR9 |
| `app/src/i18n/en.json`, `ne.json` | All UI strings in English and Nepali | FR9 |
| `app/tests/i18n.test.ts` | Fails if the two dictionaries have different keys | FR9 |
| `docs/requirements.md`, `docs/architecture.md` | FR1–FR9, NFRs, diagrams | all |
| `docs/ui-design.md` | Component tree, shared state, wireframes, screen states (the plan for M3–M6) | all, NFR4–6 |
| `app/src/ui/SidePanel.tsx` | Trek / Plan / Layers tabs (WAI-ARIA tabs pattern) | NFR11 |
| `app/src/ui/tabKeys.ts` (+ test) | Which tab an arrow / Home / End key moves to (pure function) | NFR11 |
| `app/src/features/routes/TrekPanel.tsx` | Trek tab: trek selector, status line, stop list | FR2 |
| `app/src/features/routes/useRoutes.ts` | Route list, selected trek, cache, ignoring late downloads (shared with Sparsh) | FR2 |
| `app/e2e/trek-selector.spec.ts` | Browser tests: keyboard selection, cache, failed and late downloads, tabs | FR2, NFR11 |
| `app/src/features/elevation/profile.ts` (+ test) | Profile maths: dead-band totals, highest point, stops on the profile | FR4 |
| `app/src/features/elevation/sampleHeights.ts` (+ test) | Terrain heights every ≤ 50 m, cached per route | FR4 |
| `app/src/features/elevation/ElevationSampler.tsx`, `ProfileStrip.tsx` | Sampling inside the globe; the Chart.js strip under it | FR4 |
| `app/e2e/profile.spec.ts` | Browser test: chart, totals, data note, Hide / Show | FR4 |

## Module walkthroughs

### `i18n/index.ts` — translations without a library

Every visible string has a key such as `"disclaimer.medical"`. `en.json` and `ne.json` map the
same keys to English and Nepali text. Components call `t('disclaimer.medical')`.

Two safety nets:
1. **TypeScript**: `MessageKey = keyof typeof en`, so `t('typo.key')` is a compile error, and
   `ne` is typed as `Record<MessageKey, string>`, so a key missing from `ne.json` fails `tsc`.
2. **Vitest** (`tests/i18n.test.ts`): sorts both key lists and compares them, so an *extra*
   key in either file also fails, and checks no string is empty.

Why not `react-i18next`? We have two languages and a handful of strings; 20 lines we can explain
beat a library we can't (ADR-007). The language toggle comes in M6 (#27).

### `App.tsx` + `styles.css` — layout

A three-row CSS grid: header / main / footer. The footer holds the medical disclaimer, so it is on
screen whatever the user does (NFR6). `main` is a two-column grid (globe | side panel); the media
query `@media (max-width: 900px)` applies at 900 px **or narrower** and stacks them so the app
works on tablets (NFR4). `min-height: 0` lets the globe shrink inside the grid instead of pushing
the footer off-screen.

### `docs/ui-design.md` — the plan for the whole screen (issue #7)

This is a design document, not code. It is the agreement the three of you build against in
M3–M6. What it decides:

1. **Layout.** Globe is the main content; a 320 px side panel with three tabs (Trek, Plan,
   Layers); an elevation-profile strip under the globe; the disclaimer as a footer row of the
   page grid; everything stacked at 900 px or narrower.
2. **Component tree.** Every component, its folder, owner, FR and issue number. Colours in the
   Mermaid diagram show the owner.
3. **Shared state.** A table of the 8 values more than one branch of the tree needs: 7 that
   change rarely live in `AppState` (language, selected trek, selected stop, flythrough status,
   itinerary, layers, sun time); the chart hover position, which changes many times a second,
   has its own `ProfileHoverContext`. For each: who changes it and who reads it.
4. **Wireframes.** Desktop Trek, Plan and Layers tabs and a tablet layout, as text boxes.
5. **Screen states.** What the user sees with no token, while loading, offline, with no
   warnings, and without WebGL.

**Why these choices** (ADR-018):
- *Disclaimer as a grid row, not inside the panel* — a scrolling panel could hide it; a grid row
  is always on screen.
- *Credits inside Cesium's credit area* (`viewer.creditDisplay.addStaticCredit(new Credit(html,
  true))`) — Cesium already keeps that area visible and lays it out; our own floating box could
  overlap the panel. The `true` (`showOnScreen`) puts the credit on the map; without it Cesium
  only lists it in the "Data attribution" pop-up.
- *Profile as a strip under the globe* — a multi-day chart needs width (the panel is only
  320 px), and sitting directly under the map makes the chart ↔ map link easy to see.
- *One React context (`AppState`) instead of Redux* — about 8 shared values; a library would add
  concepts to learn and explain without solving a problem we have.
- *Store inputs, compute results* — acclimatization warnings are recalculated from the itinerary
  every render, so they can never be stale.
- *Per-frame values stay out of React* — the flythrough camera moves about 60 times a second.
  Every component that reads a context re-renders when its value changes, so storing the camera
  position in `AppState` would re-render the page 60 times a second. It stays inside Cesium's
  render loop.
- *Hover gets its own small context* — moving the mouse over the chart changes the highlight many
  times a second. In `AppState` that would re-render every `AppState` reader; in
  `ProfileHoverContext` only the chart and the map marker re-render, at most once per animation
  frame.
- *Commands are method calls, not state* — "jump to day 3" is an event. Stored as state, two clicks
  store the same value twice and the receiver must guess whether it already handled it. So the
  controls call `play()`, `pause()`, `setSpeed()`, `jumpToDay()` on a flythrough controller,
  which reports `flythroughStatus` (playing?, speed) back for the buttons.

**How the wireframes were made.** They are plain text boxes, generated by a small script that pads
every line to the same width, so they line up in any monospace font. Devanagari and emoji are kept
out of the boxes because many fonts draw them wider than one column; a table under the heading
explains the stand-in symbols (for example `NE` = the नेपाली button).

**Limits (say these honestly if asked).**
- It is a plan. `AppState`, `ProfileHoverContext`, `ViewerContext`, the tabs, the profile strip
  and the static credits do not exist in the code yet; they arrive with #15, #16, #19, #21, #25
  and #26. Today the header, globe area, side panel and footer are plain elements in `App.tsx`.
  When the real app differs, update the doc and ADR-018.
- The current code has three accessibility gaps the design fixes later (table "Gaps in the
  current code" in `docs/ui-design.md`): the footer's `role="note"`, `lang="en"` fixed in
  `index.html`, and a Devanagari font that is listed but never loaded.
- The wireframes are low-fidelity: no colours, sizes or real data, and no user has tested them.
  Usability evidence comes from the questionnaire in M7.
- There is no phone layout; the requirement stops at tablet width (NFR4).

### Trek tab and side-panel tabs (issue #16)

**What the user gets.** The side panel has three tabs. The Trek tab has a "Choose a trek" list
with every route in `data/routes/index.json`, a status line ("Showing … : N overnight stops") and
the stops as "Day 1 · name · 1,000 m". Choosing a trek redraws the route on the globe and the
camera flies to it. Plan and Layers show one line saying which issue fills them.

**How the data flows.** `App` calls `useRoutes()` once and passes the result down as props:

```
useRoutes()  ──routes.current──▶  RouteLayer (draws on the globe, flies the camera)
     ▲
     └──routes.select(id)──  TrekPanel <select onChange>   ◀── the user
```

No context is needed yet: one shared value, two readers, both direct children of `App`
(ADR-026). `AppState` from the design arrives when a value is needed deep in several branches.

**`useRoutes` step by step** (`select(id)`):
1. Give this call a number: `request = latestRequest.current + 1`, and store it.
2. If the file is in the cache (a `Map` in a `useRef`), show it at once. No download.
3. Otherwise clear the map (`setCurrent(null)`), show "Loading treks…" and download.
4. When the download arrives: check its shape (inside `try`, so a bad file cannot crash the page
   and the disclaimer), put it in the cache, and use it **only if `request` is still the
   newest number**. On an error, show the error only for the newest request.

Why numbers and not trek ids? Choose B (download B1 starts), then A, then B again (B2 starts).
With ids, B1 and B2 both match "B is selected", so both are used: the camera flight restarts,
and if B2 fails the page says "could not load" next to a drawn trek. With numbers only B2 counts.
The code reviewer found this; the e2e test "a download that finishes late…" holds downloads back
and releases them in the wrong order to prove it.

**`SidePanel` — the WAI-ARIA tabs pattern.**
- `role="tablist"` (with a name), `role="tab"` buttons with `aria-selected` and `aria-controls`,
  `role="tabpanel"` divs with `aria-labelledby`. These tell a screen reader "tab 2 of 3, selected".
- *Roving tabindex:* only the selected tab has `tabIndex=0`; the others `-1`. So Tab enters the
  row once, and the arrow keys move inside it (`nextTabIndex` in `tabKeys.ts`; `% tabCount` makes
  it wrap round). Moving also selects ("automatic activation"), fine because showing a panel is
  instant.
- Panels that are not selected get the `hidden` attribute instead of being removed, so each
  tab's `aria-controls` points at an element that exists and the panel keeps its state.
- Plan and Layers have nothing to focus, so their panel itself gets `tabIndex=0`; otherwise Tab
  from the tab would jump past the text.

**Native `<select>`.** Wrapped in a `<label>`, it gets its accessible name for free, works with
Tab and arrow keys, and a phone shows its own picker. A custom drop-down would need all of that
rebuilt by hand. The footer lost `role="note"`, so it is the page's "contentinfo" landmark again.

**Day buttons (#49, Sparsh's stage maths).** Every stop after the first is a `<button>` with
`aria-pressed`: a *toggle* button, which a screen reader announces as "pressed" or "not
pressed". Pressing it highlights that day's stage on the globe; pressing again removes it. The
first stop has no button because no stage is walked to reach it. The selected stage lives in
`App` as {trek id, end-stop id, flyTo}; the trek id is checked, so a highlight never carries over
to another trek, and `TrekPanel.chooseTrek` also clears it before loading another trek.

### Elevation profile (`features/elevation/`, issue #21)

**What the user gets.** A strip under the globe: "Elevation profile", the totals ("Total ascent
… · Total descent … · Highest point … at … km"), a line chart of height against distance with the
stops as yellow dots, and a note on where the heights come from. "Hide profile" folds it away.

**Where the heights come from.**
1. `resampleTrail(trail, 50)`: points at equal intervals of at most 50 m (the synthetic Test Route
   is 22,641.3 m: ceil(22,641.3 / 50) = 453 intervals of 49.98 m → 454 samples).
2. `sampleTerrainMostDetailed`: Cesium World Terrain's height at each point, at its finest
   detail. These are heights above the WGS84 *ellipsoid*, a smooth mathematical shape, not above
   sea level like the cited stop altitudes, and the terrain model is not a survey. So the strip
   says they are not the cited altitudes, stops are drawn on the terrain line, and the cited
   altitude goes in the tooltip.
3. Cached per route id, so going back to a trek does not sample again. A failure is not cached,
   and the strip offers "Try again".
4. No height may become a silent 0 m: a failed tile fails the sampling, and heights start as NaN
   so an unfilled one is caught.
5. No token → no terrain → no profile: the strip shows only a notice, no numbers, no chart.

**Dead band, worked.** The rule: a step further in the SAME direction always counts; a step
the OTHER way counts only once it is at least 5 m from the last counted height. Heights 100,
103, 101, 110, 108, 120, 95: no direction yet, 103 and 101 are within 5 m, ignored; 110 is +10 →
ascent 10, now climbing; 108 is −2 the other way, under 5, ignored; 120 is +10 the same way →
ascent 20; 95 is −25 the other way, over 5 → descent 25. Totals: 20 m up, 25 m down. Summing every
step would give 24 and 29: the wobbles 3, 2, 2 and 2 m are noise. (A first version only counted
from turning points and dropped the last few metres before each peak: up to 1,104 and back in
1 m steps gave 100/100 instead of 104/104. Code review found it; a test now checks it.)

**Totals as walked.** The totals follow the trek stop to stop in day order, each stage in its
own direction (`walkedTotals`). For an out-and-back trek the trail line is stored once, so
"the line once" would leave out the whole way back.

**Chart.js and React.** Chart.js draws on a `<canvas>` outside React, like Cesium. The chart is
created in an effect and destroyed in its cleanup (when the profile changes, the strip is hidden
or the page closes). A canvas is just pixels to a screen reader, so it has `role="img"` and an
`aria-label` summary, and the totals are also text.

**Data flow.** `ElevationSampler` sits inside `CesiumGlobe` (it needs the terrain) and reports
`{status, routeId, profile}` to `App` with a callback; `App` passes it to `ProfileStrip` under
the globe. The same pattern as the flythrough's controller. The header's status line is one live
region that is always on the page, so screen readers announce loading, errors and the totals,
and it stays visible when the chart is hidden.

## Key concepts from first principles

- **i18n** ("internationalisation", 18 letters between i and n): designing the app so text can be
  swapped per language without changing code.
- **Devanagari rendering**: Nepali needs a font with Devanagari glyphs. Our CSS list is
  `system-ui, 'Segoe UI', 'Noto Sans Devanagari', sans-serif`: the browser tries each in order
  and, for each character, uses the first font that has it. Nothing loads Noto Sans Devanagari, so
  it is only used if it is already installed; otherwise the system's Devanagari font (for example
  Nirmala UI on Windows) draws the Nepali text.
- **Accessibility roles**: roles tell assistive technology what an element is. `role="status"` on
  the no-token notice makes it a polite *live region*: a screen reader reads out *changes* to its
  text, not the text that is already there when the page loads. `role="note"` on the footer only
  labels it as a note when a reader reaches it; it is not read out automatically, and it replaces
  the footer's built-in "contentinfo" landmark, which is why the design removes it in #16. Tests
  can find elements by role (`getByRole`), which is why the smoke test must change at the same
  time.
- **`lang` attribute**: `<html lang="en">` tells screen readers which language to pronounce. When
  the user switches to Nepali it must become `ne` (#27).
- **ARIA tabs pattern**: `role="tablist"` on the row, `role="tab"` + `aria-selected` +
  `aria-controls` on each tab, `role="tabpanel"` on each panel; only the selected tab is a Tab-key
  stop and the arrow keys move between tabs.
- **Stale response (race condition)**: two downloads run at the same time and the slower,
  older one finishes last. If the code just uses "whatever arrives", the screen shows the old
  answer. Fix: remember which request is the newest and ignore the others.
- **`useRef` vs `useState`**: both keep a value between renders; changing state re-renders the
  component, changing a ref does not. The cache and the request counter are refs because the
  screen does not depend on them directly.
- **Component tree**: which component renders which. `App` renders `Header`, `GlobeArea`,
  `SidePanel` and the footer; `SidePanel` renders three tabs; and so on down.
- **Prop drilling vs React context**: to get the selected trek from `TrekSelector` (inside the
  side panel) to `RouteLayer` (inside the globe), you could pass it as a prop through every
  component in between, even ones that don't use it. That is "prop drilling". A context lets
  `App` provide the value once and any component below read it:

  ```tsx
  const AppState = createContext<{ selectedRouteId: string | null }>({ selectedRouteId: null });
  // in App:        <AppState.Provider value={{ selectedRouteId }}> ... </AppState.Provider>
  // in RouteLayer: const { selectedRouteId } = useContext(AppState);
  ```

  (A sketch for understanding. #16 did not need it: `App` passes the trek down as props,
  see ADR-026. The context is built when a value is needed in several branches.)
- **Re-render**: when state a component uses changes, React calls that component function again
  to work out the new screen. Cheap for a button, expensive if it happens to the whole page 60
  times a second; hence "per-frame values stay out of React". With contexts: **every component
  that reads a context re-renders when that context's value changes**, even if it only uses one
  field. That is why a fast-changing value gets its own small context.
- **Derived state**: a value you can compute from other state (warnings from the itinerary).
  Storing it as well creates two copies that can disagree, so we compute it instead.
- **Wireframe fidelity**: low-fidelity = boxes and labels to agree on layout; high-fidelity =
  colours, real sizes and data. We only need low-fidelity before building.
- **Touch target size**: WCAG 2.1 success criterion 2.5.5 (Target Size, level AAA) asks for at
  least 44 × 44 CSS pixels, which is why tablet tabs are 44 px tall.

## Likely viva questions

1. **How does `t()` work?** — Looks up the key in the chosen dictionary; falls back to English,
   then to the key itself so nothing crashes.
2. **What stops someone forgetting a Nepali translation?** — `tsc` (missing key) and the Vitest
   parity test (missing or extra key); both run in CI.
3. **Why keep the disclaimer in the layout footer?** — It must be visible on every screen; putting
   it in one place guarantees that.
4. **How is the layout responsive?** — CSS grid + one media query at 900 px.
5. **Who checked the Nepali?** — Nobody yet: it is machine-drafted and listed in
   `docs/i18n-review.md` for native-speaker review.
6. **Why a static site?** — Free hosting, nothing to secure; see `docs/architecture.md`.
7. **What would you improve?** — A language toggle that remembers the choice (M6), showing
   numbers in Nepali digits (०१२…) when Nepali is selected, and testing the wireframes with real
   users before building (we only test after, in M7).
8. **Where is the medical disclaimer, and why can't it be hidden?** — In the footer row of the page
   grid, outside every scrolling area; the Plan tab repeats it next to the warnings.
9. **Where do the data credits go, and why there?** — In Cesium's credit area at the bottom-left
   of the globe, added as `new Credit(html, true)` with `addStaticCredit`; the `true` makes it show
   on the map, not only in the "Data attribution" pop-up. Open-Meteo's credit is also shown next
   to the weather values.
10. **What is in `AppState` and why not put everything there?** — Only values that components in
    different branches share and that change rarely (7 of them). Every component that reads
    `AppState` re-renders when any of them changes, so values one component uses stay local
    (`useState`) and the fast-changing hover value has its own context.
11. **Why isn't the flythrough camera position in React state?** — It changes about 60 times a
    second; each change would re-render every reader. It stays in Cesium's render loop.
12. **Why are acclimatization warnings not stored?** — They can be computed from the itinerary;
    storing both creates two copies that can disagree.
13. **Why was Redux not used?** — About 8 shared values; React context is enough and easier to
    explain (ADR-018).
14. **Why is the elevation profile under the globe and not in the side panel?** — The panel is
    320 px wide, too narrow for a multi-day chart, and under the map the chart ↔ map link is
    easy to follow.
15. **What happens on a 768 px tablet?** — Today the 900 px media query stacks the globe, the side
    panel (scrolls inside, at most 40% of the height) and the footer. The planned profile strip
    (#21) will sit between globe and panel, collapsed by default.
16. **Why are there no numbers in the wireframes?** — They describe layout, not data; real values
    come from cited route files and live APIs, and we never invent data.
17. **The mouse moves over the chart. What re-renders?** — `profileHighlightM` changes in
    `ProfileHoverContext`, so only its readers re-render: the chart and the map marker, at most
    once per animation frame. If it were in `AppState`, every `AppState` reader would re-render.
18. **"Jump to day 3" is clicked twice. What happens?** — Each click calls
    `controller.jumpToDay(3)`, so the jump runs twice, as the user expects. If the command were
    stored as state, the second click would store the same value and the receiver could not tell
    it was a new click.
19. **When the user picks Nepali, what else must change besides the text?** — `<html lang>` must
    become `ne` so screen readers pronounce it correctly, and a Devanagari font must be available.
20. **How will you test the tablet layout (NFR4)?** — A Playwright test at 768 × 1024 checks that
    the globe, panel and disclaimer are visible and the panel is below the globe (#32). Today's
    smoke test only uses the default desktop size.
21. **Which parts of #7 did the AI tool write, and how did you check them?** — See "AI use in
    this part" below; answer in your own words after checking the design against the app.
22. **What was hardest?** — TODO(Dipson): answer from your own experience.
23. **Why a native `<select>` for the trek selector?** — Keyboard support, a screen-reader name
    (from its `<label>`) and the phone picker come free; a custom list would have to rebuild them.
24. **Only one tab can be reached with Tab. Isn't that worse for keyboard users?** — No: it is
    the WAI-ARIA pattern. Tab enters the row once; arrows move inside. Otherwise a keyboard user
    would press Tab through every tab to reach the panel.
25. **What happens if the user picks B, then A, then B while B is still downloading?** — Each
    `select()` gets a number; only the newest request's answer is used, so the first B download
    is ignored (but cached). Show the e2e test that proves it.
26. **Why does choosing an uncached trek clear the map?** — Otherwise the old trek would stay on
    the globe under the new name while loading, or for good if the download fails.
27. **Why is `select` wrapped in `useCallback`?** — The effect that loads the index lists
    `select` as a dependency. `useCallback(..., [])` keeps it the same function on every render,
    so the effect runs once (twice in development under StrictMode, which the `cancelled` flag
    makes harmless).
28. **Why are hidden tab panels kept in the page?** — Each tab's `aria-controls` must point at an
    element that exists, and the panel keeps its state while another tab is shown.
29. **How do you know the tabs work without a mouse?** — `trek-selector.spec.ts` drives them with
    ArrowLeft/Right, Home, End and Tab and checks focus, `aria-selected` and that exactly one tab
    is a Tab stop; `tabKeys.test.ts` checks the key → index maths.
30. **How is total ascent computed, and why not just add up every rise?** — With a 5 m dead band:
    steps the same way always count, a step the other way only from 5 m; summing every
    sample-to-sample wobble would inflate it. Show the worked example.
31. **Are the profile heights the altitudes of the stops?** — No: terrain heights above the WGS84
    ellipsoid from Cesium World Terrain. The cited stop altitudes are above sea level from other
    sources; the strip says so and the tooltip shows the cited altitude.
32. **Why is a failed terrain tile an error, not a 0?** — A 0 m height would look like a cliff
    and wreck the totals; better to say "could not load" and let the user retry.
33. **How does a screen reader user get the chart's information?** — The canvas has `role="img"`
    with a summary, and the totals are written out as text.
34. **Why is the chart created in useEffect and destroyed in the cleanup?** — It draws on a canvas
    outside React; without destroy, each new profile would leave an old chart (and its listeners)
    behind.
35. **What does the strip show without a Cesium token, and why not "0 m"?** — Only a notice: there
    is no terrain, and "0 m" would present an untrue number as a fact.
36. **Why "as walked" totals?** — For an out-and-back trek the line is stored once; walking it
    stop to stop counts the way back too.

## Prove you understand it (do these by hand, no AI)

1. Add a key `"panel.title"` to `en.json` only; run `npm run typecheck` and `npm test`; read both
   failures; then add the Nepali string and make them pass.
2. Change the media-query breakpoint to 768 px and check the layout in the browser's device mode.
3. Explain (out loud) why `t()` returns the key itself when a translation is missing.
4. Add the `glossary.md` entry for a term you had to look up this week.
5. On paper, draw the component tree from memory, then compare it with `docs/ui-design.md` and
   explain any component you forgot.
6. Pick one shared value (for example `profileHighlightM`) and trace it: which component sets it,
   on which user action, and which components re-render when it changes.
7. Sketch a phone layout (about 400 px wide) for the Trek tab and write down one thing in
   ADR-018 you would have to change to support it.
8. Run `npm run dev`, put the mouse away, and use only Tab, Shift+Tab, the arrow keys, Home and
   End to reach every tab and the trek selector. Write down anything you could not reach.
9. In `useRoutes.ts`, change the check `latestRequest.current !== request` back to compare trek
   ids (keep the id in the ref instead). Run `npx playwright test e2e/trek-selector.spec.ts` and
   explain which test fails and why. Undo the change.
10. Work out by hand `nextTabIndex(0, 'ArrowLeft', 3)` and `nextTabIndex(2, 'ArrowRight', 3)`,
    then check your answers against `tabKeys.test.ts`.
11. Work out the dead-band totals by hand for 500, 506, 503, 511, 509, 498 with a 5 m band, then
    add your answer as a test in `profile.test.ts`.
12. Change `CLIMB_THRESHOLD_M` to 0 and to 20, look at the totals for the synthetic route in the
    browser (with the token), and explain the difference. Change it back.
13. Turn on a screen reader (Narrator on Windows: Ctrl+Win+Enter), go to the profile strip with
    the keyboard and write down what it reads for the heading, the totals, the chart and the button.

## AI use in this part

- **Issue #7 (2026-11-20):** Claude Code drafted `docs/ui-design.md`, ADR-018 and the UI-design
  sections of these notes. It generated the text wireframes with a script so the boxes line up.
- **Checks:** a viva-examiner subagent checked these notes and the design doc against the code.
  It found real mistakes, which were corrected:
  - wrong claims about what `role="note"` and `role="status"` do;
  - a font described as loaded when nothing loads it;
  - hover updates in one shared context, which would re-render every reader;
  - flythrough commands stored as state;
  - components marked "(exists)" that are really plain elements.

  Mermaid's own parser checked both diagrams.
- **Issue #16 (2026-11-22):** Claude Code wrote `useRoutes` selection and caching,
  `TrekPanel`, `SidePanel`, `tabKeys` and their tests, the new strings (Nepali machine-drafted),
  ADR-026 and this section. A code-reviewer subagent found the B → A → B race, weak tab tests, a
  missing Tab stop on empty panels and touch targets under 44 px; all fixed. Mutation checks
  showed each new e2e test fails when its behaviour is removed.
- **Issue #21 (2026-11-23):** Claude Code wrote `profile.ts`, `sampleHeights.ts`,
  `ElevationSampler.tsx`, the strip (now `ProfileStrip.tsx`), their tests, ADR-030 and this
  section, and added chart.js. It ran the browser tests with and without a token. A code-reviewer
  subagent found untrue numbers (0 m without terrain, totals missing the way back, a dead band
  that dropped the last metres before a peak) and smaller issues; all fixed, with tests that fail
  if the fixes are undone.
- **What you must still do:** read the design doc and challenge it (does the layout suit how a
  trekker plans?), compare it with the real app as each feature lands, and do exercises 5–7 and
  11–13 by hand.

## Changelog

- 2026-11-19 — M0: layout, disclaimer, i18n helper + parity test, requirements, architecture.
- 2026-11-22 — M3 #16: Trek tab and side-panel tabs walkthrough, stale-response and
  `useRef` concepts, questions 23–29, exercises 8–10, AI use.
- 2026-11-23 — M4 #21: elevation profile walkthrough (where heights come from, dead band worked
  example, Chart.js lifecycle, data flow), questions 30–34, exercises 11–13, AI use.
- 2026-11-20 — M1 #7: UI design walkthrough (layout, component tree, shared state, wireframes,
  limits), concepts (context, re-render, derived state, roles, lang, ARIA tabs), questions 8–22,
  exercises 5–7, AI use; corrected after the viva-examiner check.
