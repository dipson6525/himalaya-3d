# Viva notes — Unique Ghimire (041053-25)

Areas: route data (`data-prep/`, `data/routes/`), trek content, acclimatization rules
(`app/src/lib/acclim/`) and itinerary UI (`app/src/features/acclimatization/`).
Labels: `area:route-data`, `area:trek-content`, `area:acclimatization`.

## Your part in one paragraph

You own the data and the safety logic. You turn OpenStreetMap trails and published trek
information into clean route files with honest, cited altitudes (M2), and you build the
acclimatization checker that flags itineraries that gain sleeping altitude too fast, following
the Wilderness Medical Society guidelines (M5). In M0 that is the Python project: a reproducible
environment, shared folder paths, a citation template, and smoke tests.

## File map (so far)

| File | Purpose | FR |
| --- | --- | --- |
| `data-prep/requirements.txt` | Pinned Python packages (gpxpy, shapely, pyproj, requests, pytest, ruff) | FR2 |
| `data-prep/pyproject.toml` | ruff + pytest settings | — |
| `data-prep/prep/paths.py` | Folder constants every script uses | FR2 |
| `data-prep/tests/test_environment.py` | Proves the libraries import and folders exist | — |
| `data-prep/cache/` | Committed Overpass responses (ODbL) | FR2 |
| `data/routes/route-sources.md` | Every altitude's source + disagreements table | FR3, NFR9 |
| `docs/data-schema.md` | The rules every route file must follow | FR2, FR3 |
| `data-prep/prep/schema.py` | Validator: checks a route file and lists every problem | FR2, FR3 |
| `data-prep/tests/test_schema.py` | One test per rule, plus a check of every real route file | FR2, FR3 |
| `app/src/features/routes/types.ts` | The same shape as TypeScript types + type guards, for the front end | FR2, FR3 |
| `app/src/features/routes/types.test.ts` | Vitest check of the type guards | FR2, FR3 |

Coming next: Overpass pipeline (#8), four routes (#9–#12), altitude cross-check (#13),
acclimatization rules (#23), itinerary UI (#24).

## Module walkthroughs

### Virtual environment and pinned requirements

A **venv** is a private copy of Python's package folder for one project, so our package versions
don't clash with other projects. **Pinning** (`shapely==2.2.0`) means everyone — and CI — installs
exactly the same versions, so "works on my laptop" also means "works in CI".

### `prep/paths.py`

`Path(__file__).resolve().parents[1]` is the `data-prep/` folder no matter where you run the
script from; the project root is its parent. Scripts import `ROUTES_DIR`, `CACHE_DIR` instead of
typing paths, so moving a folder means changing one line.

### Why cache Overpass responses in git?

Overpass is a free service run by volunteers. Each query can be heavy. We query **once**, save the
raw JSON in `data-prep/cache/`, and every later run reads the file. This is polite, makes the
pipeline reproducible offline, and lets reviewers see exactly what data we started from.

### The route schema and validator (`docs/data-schema.md`, `prep/schema.py`)

**What a route file is.** One GeoJSON FeatureCollection per trek: one `route` feature (the trail as
a LineString) and one `stop` feature per overnight stop (a Point), in walking order. Every feature
has `properties.kind` so the app can tell them apart.

**Data flow of the validator.**

```
route file ──json.loads──► validate_route(data, known_sources, expected_id)
                              1. top level is a FeatureCollection?
                              2. sort features into route / stops (by kind)
                              3. check each feature: names of properties, text, id, source,
                                 day, altitude, geometry, positions
                              4. compare stops: unique ids, days increasing
                           ──► list of error messages ([] = valid)
route-sources.md ──parse_source_ids──► {"OSM", ...} = known_sources
```

**Key functions.**
- `validate_route` — the whole-file check above; returns every problem, not just the first, so
  you can fix a file in one pass.
- `validate_file` — loads a `.geojson` file, reports bad JSON, and uses the file name as the
  expected route id.
- `parse_source_ids` — reads the first column of the "## Sources" table in `route-sources.md`.
- `_check_position` — `[lon, lat]` inside a loose box around Nepal; if the numbers look swapped
  it says "looks like [lat, lon]".
- `_check_text` — non-empty, no `TODO`, and Nepali fields must contain Devanagari.
- `main` — `python -m prep.schema` checks every file in `data/routes/` and exits with 1 on errors.

**Why this design.**
- *Return a list of messages instead of raising an exception* — the first error would hide the rest.
- *Plain Python, no JSON-Schema library* — every rule is a few readable lines you can explain;
  a JSON Schema could not express "days increase" or "Source ID listed in a Markdown table" anyway.
- *Positions only in the geometry* — storing `lat`/`lon` twice would let the copies disagree.
- *No rest-day field* — nights at a stop = next stop's `day` − this stop's `day`, so the data
  cannot contradict itself.
- *Reject `TODO` and unknown property names* — makes "never invent data" and typo-catching
  automatic in CI instead of relying on reviewers.

## Key concepts from first principles

- **GeoJSON**: a JSON format for map features. Coordinates are `[longitude, latitude]` — note
  the order, the opposite of how people usually say "lat, lon".
- **Douglas–Peucker simplification** (`shapely.simplify`): removes points that are closer than a
  tolerance to the straight line between their neighbours. The smoke test checks the simplest case:
  `(0,0) (1,0) (2,0)` → the middle point lies exactly on the line, so it is removed.
- **ODbL**: OpenStreetMap's licence — you may use the data if you credit "© OpenStreetMap
  contributors" and share derived databases under the same licence.
- **Bounding box**: the smallest latitude/longitude rectangle you accept. Ours (26.0–31.0 °N,
  79.5–88.5 °E) is a loose box around Nepal. Worked example of a swap: a stop near
  `[85.0, 28.0]` typed as `[28.0, 85.0]` has "longitude" 28.0 (outside 79.5–88.5) but both
  numbers fit the box the other way round, so the validator says "looks like [lat, lon]".
- **Nights from days (worked example with the test data)**: stop A `day: 1`, stop B `day: 3`
  → nights at A = 3 − 1 = 2, so day 2 is a rest day at A. Sleeping altitudes per night:
  night 1 = A, night 2 = A, night 3 = B. M5's checker starts from exactly this list.
- **Devanagari**: the script Nepali is written in; Unicode block U+0900–U+097F. Checking for at
  least one such character catches English accidentally pasted into `name_ne`.
- **The acclimatization rule (preview for M5)**: above 3,000 m, don't raise your *sleeping*
  altitude by more than 500 m per day, and take a rest day every 3–4 days (Luks et al. 2019;
  unchanged in the 2024 update).

## Likely viva questions

1. **Why Python for data prep and not the browser?** — It runs once, offline; Python has mature
   geometry libraries; the browser only loads the small result.
2. **Why no GDAL?** — Doesn't install cleanly on Windows; gpxpy/shapely/pyproj cover our needs (ADR-006).
3. **What does pinning versions protect against?** — A new library release changing behaviour
   between laptops or between laptop and CI.
4. **How do you make sure an altitude is not made up?** — Every stop references a source ID in
   `route-sources.md`; differences > 50 m vs other sources or terrain are flagged, not hidden.
5. **Why commit the cache?** — Reproducibility and Overpass etiquette.
6. **What is GeoJSON coordinate order?** — `[lon, lat]`.
7. **How does CI stop a broken route file reaching `main`?** — `test_every_route_file_follows_the_schema`
   runs `validate_file` on each file in `data/routes/`; any error fails `pytest` in the data-prep job.
8. **Why are `lat`/`lon` not properties?** — They are already the Point's coordinates; a second
   copy could disagree with the first.
9. **How do you represent a rest day?** — Not with a field: the next stop's `day` jumps by 2.
   Nights at a stop = next day − this day.
10. **Why reject `TODO` in `data/routes/`?** — The app shows these values to trekkers; unverified
    numbers must never look like facts. Drafts stay in data-prep working files.
11. **Why plain Python instead of a JSON Schema library?** — Some of our rules (days increasing,
    Source IDs from a Markdown table) cannot be expressed in JSON Schema, and plain code is easy
    to explain line by line.
12. **Why does the validator return a list instead of stopping at the first error?** — So you see
    every problem in one run.
13. **What happens if `day` is `true` in the JSON?** — In Python `True` is an `int` subclass, so
    the validator checks `isinstance(day, bool)` first and rejects it.
14. **Why must the first stop be day 1?** — The acclimatization checker (M5) builds one sleeping
    altitude per night starting at night 1; a file starting at day 5 would leave nights 1–4 empty.
15. **How does the front end know a feature is the route and not a stop?** — The type guards
    `isRouteFeature` / `isStopFeature` in `types.ts` check `properties.kind`; after the check
    TypeScript knows the geometry type (tested in `types.test.ts`).
16. **What would you improve?** — Check that each stop lies close to the trail line (needs
    shapely + a metric projection); validate `route-sources.md` itself (no duplicate IDs).

## Prove you understand it (do these by hand, no AI)

1. Write a new pytest case where `simplify` must KEEP the middle point (move it off the line by
   more than the tolerance). Predict the result before running it.
2. Add a `GPX_DIR` constant to `paths.py` for raw GPX files and a test that it is under `data-prep/`.
3. Explain, using a sketch, how Douglas–Peucker decides which points to drop.
4. Find one published source for Namche Bazaar's altitude and add it to `route-sources.md`.
5. Add an optional `notes_en` property to stops: update `docs/data-schema.md`,
   `STOP_PROPERTIES` handling (it must be allowed but not required), a test, and `types.ts`.
6. Change the bounding box so it is tighter on the west side, predict which existing test (if any)
   breaks, then run `pytest` to check your prediction. Revert afterwards.
7. Write the list of sleeping altitudes per night for a 3-stop synthetic route with days 1, 2, 4
   using the "nights from days" rule — on paper.

## Changelog

- 2026-11-19 — M0: venv, pinned requirements, paths, cache policy, citation template.
- 2026-11-20 — M1 #6: route schema, validator walkthrough, worked examples, questions 7–16, exercises 5–7.
