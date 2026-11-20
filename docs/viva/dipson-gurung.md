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

  (A sketch for understanding; the real context is written in #16.)
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
- **What you must still do:** read the design doc and challenge it (does the layout suit how a
  trekker plans?), compare it with the real app as each feature lands, and do exercises 5–7 by
  hand.

## Changelog

- 2026-11-19 — M0: layout, disclaimer, i18n helper + parity test, requirements, architecture.
- 2026-11-20 — M1 #7: UI design walkthrough (layout, component tree, shared state, wireframes,
  limits), concepts (context, re-render, derived state, roles, lang, ARIA tabs), questions 8–22,
  exercises 5–7, AI use; corrected after the viva-examiner check.
