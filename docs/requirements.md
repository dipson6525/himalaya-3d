# Requirements — Himalaya 3D

KU COMP 206 · Owner of this document: Dipson Gurung · Issue #3

> TODO(team): verify that the FR numbering below matches the numbering in the proposal you
> submitted. If it differs, renumber here and in the GitHub issues so the report stays consistent.

## Purpose

A free, browser-based 3D map of Nepal's trekking routes that lets a trekker explore a route on
real terrain, fly along it, read its elevation profile, plan a day-by-day itinerary with a
general acclimatization check, and see live earthquake and weather information.

## Users

- **Trekkers planning a trip** — want to see the route, the climb, and whether the itinerary
  gains height too fast.
- **Students / teachers** — want an interactive geography and data-visualization example.

## Functional requirements

| ID | Requirement | Owner | Milestone | How we will test it |
| --- | --- | --- | --- | --- |
| FR1 | Show an interactive 3D globe centred on Nepal with real terrain and imagery; user can rotate, zoom and tilt. | Sparsh | M3 | Playwright: canvas renders, camera starts over Nepal; manual check of controls |
| FR2 | Show at least 4 trekking routes (Everest Base Camp, Annapurna Circuit, Langtang Valley, + one team choice) as lines clamped to the terrain; user selects a route. | Unique (data), Sparsh (drawing), Dipson (selector) | M2–M3 | pytest validates GeoJSON; Playwright selects each route |
| FR3 | Show overnight stops as markers; clicking one shows name (EN/NE), altitude with source, day number and description. | Unique (content), Sparsh (popups) | M2–M3 | Playwright clicks a stop and reads the popup |
| FR4 | Animated flythrough along the selected route at constant ground speed with play, pause, speed and jump-to-day controls. | Sparsh | M4 | Vitest for distance/spline maths; Playwright for controls |
| FR5 | Elevation profile chart of the route (total ascent, total descent, highest point) linked both ways with a marker on the map. | Dipson | M4 | Vitest for ascent/descent maths; Playwright hover test |
| FR6 | Editable day-by-day itinerary with an acclimatization checker that flags days that break the Wilderness Medical Society guidance, with a visible "not medical advice" disclaimer. | Unique | M5 | Vitest test matrix incl. exactly 3000 m / exactly 500 m; Playwright flag test |
| FR7 | Live layers: recent earthquakes (USGS) sized/coloured by magnitude, and current + forecast weather (Open-Meteo) at overnight stops, with offline/error states. | Dipson | M6 | Vitest for mapping logic; Playwright with mocked network |
| FR8 | Date/time slider that moves the sun (globe lighting) and previews sunrise/sunset at a selected stop. | Dipson | M6 | Playwright moves slider; manual visual check |
| FR9 | Full English/Nepali interface toggle; every UI string exists in both languages. | Dipson | M6 | Vitest key-parity test (exists since M0); Playwright language switch |

## Non-functional requirements

| ID | Requirement | How we will verify it |
| --- | --- | --- |
| NFR1 | ≥ 30 fps while exploring and during the flythrough on laptops with integrated graphics. | FPS overlay (#29); team fills `docs/testing/` FPS-by-laptop table on real laptops |
| NFR2 | First load ≤ ~10 s on ordinary home broadband. | Load-time script + Lighthouse (#30); team records real measurements |
| NFR3 | Works in current Chrome, Firefox and Edge. | Manual check on each browser, recorded in `docs/testing.md` |
| NFR4 | Usable down to tablet width (768 px). | Playwright at 768 px viewport + manual check |
| NFR5 | Every data source is credited on the map: Cesium, © OpenStreetMap contributors, USGS, "Weather data by Open-Meteo.com". | Playwright checks credit text; release checklist |
| NFR6 | The medical disclaimer is visible on every screen. | Playwright smoke test (exists since M0) |
| NFR7 | Static site only (GitHub Pages); no custom server; stays within free API limits (Open-Meteo < 10,000 calls/day; Overpass only during data prep, cached). | Architecture review; request batching + caching in code |
| NFR8 | No secrets in the repository; the production Cesium token is restricted to the Pages URL. | `.gitignore`, CI secret, ion Allowed-URLs setting |
| NFR9 | Data honesty: every altitude cites a published source; disagreements > 50 m are flagged. | `data/routes/route-sources.md`, pytest schema check |
| NFR10 | Maintainability: TypeScript strict, lint + typecheck + tests in CI, header comment per file, doc comment per non-trivial function. | CI workflow; code-reviewer subagent |

## Out of scope

- Turn-by-turn navigation, GPS tracking or offline maps on a phone.
- Booking, permits or payments.
- Medical diagnosis. The acclimatization checker gives general guidance only.

## References

- Luks AM, Auerbach PS, Freer L, et al. Wilderness Medical Society Clinical Practice Guidelines
  for the Prevention and Treatment of Acute Altitude Illness: 2019 Update.
  *Wilderness Environ Med.* 2019;30(4S):S3–S18.
- Luks AM, Beidleman BA, Freer L, et al. Wilderness Medical Society Clinical Practice Guidelines
  for the Prevention, Diagnosis, and Treatment of Acute Altitude Illness: 2024 Update.
  *Wilderness Environ Med.* 2024;35(1_suppl):2S–19S.
