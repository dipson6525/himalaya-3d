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

Coming next: data schema + validator (#6), Overpass pipeline (#8), four routes (#9–#12),
altitude cross-check (#13), acclimatization rules (#23), itinerary UI (#24).

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

## Key concepts from first principles

- **GeoJSON**: a JSON format for map features. Coordinates are `[longitude, latitude]` — note
  the order, the opposite of how people usually say "lat, lon".
- **Douglas–Peucker simplification** (`shapely.simplify`): removes points that are closer than a
  tolerance to the straight line between their neighbours. The smoke test checks the simplest case:
  `(0,0) (1,0) (2,0)` → the middle point lies exactly on the line, so it is removed.
- **ODbL**: OpenStreetMap's licence — you may use the data if you credit "© OpenStreetMap
  contributors" and share derived databases under the same licence.
- **The acclimatization rule (preview for M5)**: above 3,000 m, don't raise your *sleeping*
  altitude by more than 500 m per day, and take a rest day every 3–4 days (Luks et al. 2019;
  unchanged in the 2024 update).

## Likely viva questions (M0 part — more added with each feature)

1. **Why Python for data prep and not the browser?** — It runs once, offline; Python has mature
   geometry libraries; the browser only loads the small result.
2. **Why no GDAL?** — Doesn't install cleanly on Windows; gpxpy/shapely/pyproj cover our needs (ADR-006).
3. **What does pinning versions protect against?** — A new library release changing behaviour
   between laptops or between laptop and CI.
4. **How do you make sure an altitude is not made up?** — Every stop references a source ID in
   `route-sources.md`; differences > 50 m vs other sources or terrain are flagged, not hidden.
5. **Why commit the cache?** — Reproducibility and Overpass etiquette.
6. **What is GeoJSON coordinate order?** — `[lon, lat]`.
7. **What would you improve?** — Automatic schema validation in CI for every route (coming in #6).

## Prove you understand it (do these by hand, no AI)

1. Write a new pytest case where `simplify` must KEEP the middle point (move it off the line by
   more than the tolerance). Predict the result before running it.
2. Add a `GPX_DIR` constant to `paths.py` for raw GPX files and a test that it is under `data-prep/`.
3. Explain, using a sketch, how Douglas–Peucker decides which points to drop.
4. Find one published source for Namche Bazaar's altitude and add it to `route-sources.md`.

## Changelog

- 2026-11-19 — M0: venv, pinned requirements, paths, cache policy, citation template.
