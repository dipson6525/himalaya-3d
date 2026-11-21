# Requirements — Himalaya 3D

KU COMP 206 · Owner of this document: Dipson Gurung · Issue #3

The FR numbers and wording follow **Table 4.1 of the submitted proposal** (19 November 2026), so
the code, the issues and the final report all use the same numbers. Each row adds what we will
build and how we will test it.

> Renumbered on 2026-11-21. The first draft split "routes" and "stops" into FR2 and FR3, which
> shifted the later numbers by one. Old → new: FR3 → FR2, FR4 → FR3, FR5 → FR4,
> FR6 → FR5 (checker) and FR6 (editable itinerary).

## Purpose

A free, browser-based 3D map of Nepal's trekking routes that lets a trekker explore a route on
real terrain, fly along it, read its elevation profile, plan a day-by-day itinerary with a
general acclimatization check, and see live earthquake and weather information.

## Users

- **Trekkers planning a trip** — want to see the route, the climb, and whether the itinerary
  gains height too fast.
- **Students / teachers** — want an interactive geography and data-visualization example.

## Functional requirements

| ID | Requirement (proposal Table 4.1) | What we build | Owner | Milestone | How we will test it |
| --- | --- | --- | --- | --- | --- |
| FR1 | The system shall display Nepal in 3D with terrain and satellite imagery, and allow rotating, zooming and tilting. | Cesium globe centred on Nepal with World Terrain and ion imagery. | Sparsh | M3 | Playwright: canvas renders, camera starts over Nepal; manual check of controls |
| FR2 | The user shall be able to select a trek and see its route, stops and daily stages on the map. | At least 4 treks (Everest Base Camp, Annapurna Circuit, Langtang Valley + one team choice) as lines clamped to the terrain; stop markers whose popup shows name (EN/NE), altitude with source, day and description; each day's stage (trail between consecutive stops) highlightable. | Unique (data), Sparsh (drawing), Dipson (selector) | M2–M3 | pytest validates every route file; Playwright selects each trek and clicks a stop |
| FR3 | The system shall play an animated flythrough of the selected route with play, pause, speed and day controls. | Catmull–Rom camera path at constant ground speed, smoothed heading. | Sparsh | M4 | Vitest for distance/spline maths; Playwright for the controls |
| FR4 | The system shall show an elevation profile linked to the position on the 3D map. | Chart.js profile sampled about every 50 m, overnight stops marked, total ascent / descent / highest point; hover moves a map marker and the flythrough position shows on the chart. | Dipson | M4 | Vitest for ascent/descent maths; Playwright hover test |
| FR5 | The system shall check an itinerary against acclimatization guidelines and highlight unsafe days. | WMS rule (Luks et al. 2019, 2024): flag a day above 3,000 m that sleeps more than 500 m higher than the night before, and more than three consecutive nights of higher sleeping above 3,000 m without a rest day; "not medical advice" disclaimer. | Unique | M5 | Vitest test matrix incl. exactly 3,000 m and exactly 500 m |
| FR6 | The user shall be able to edit an itinerary and see the updated check immediately. | Add, remove and move days, change the sleeping stop; warnings update on every change. | Unique | M5 | Playwright: edit a day, the warning appears or disappears |
| FR7 | The system shall show recent earthquakes and the weather at overnight stops. | USGS earthquakes sized/coloured by magnitude; Open-Meteo current + forecast at stops; offline/error states. | Dipson | M6 | Vitest for mapping logic; Playwright with mocked network |
| FR8 | The user shall be able to set the date and time to view the position of the sun. | Date/time slider driving globe lighting; sunrise/sunset preview at a stop. | Dipson | M6 | Playwright moves slider; manual visual check |
| FR9 | The interface shall be available in Nepali and English. | Language toggle; every UI string in `en.json` and `ne.json`. | Dipson | M6 | Vitest key-parity test (since M0); Playwright language switch |

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
| NFR11 | Easy to use for people with no experience of 3D software (proposal, section 4.0.1). | The 10+ user questionnaire (#31), filled in by real users |

NFR1–NFR4, NFR5, the safety-labelling part of NFR6 and NFR11 come from the proposal's
non-functional requirements; NFR7–NFR10 are the team's own engineering rules.

## Differences from the proposal (for the final report)

- **GDAL:** the proposal lists Python with gpxpy and GDAL for route preparation. GDAL does not
  install cleanly on Windows, so the pipeline uses gpxpy, shapely and pyproj instead (ADR-006,
  ADR-019).
- **Daily stages:** the proposal says the scripts will "split them into daily stages". We store
  one trail line and the overnight stops with their day numbers; each day's stage is the part of
  the trail between two consecutive stops, worked out in the app (#15) instead of stored twice.

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
