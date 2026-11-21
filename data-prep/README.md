# data-prep/ — route data pipeline (owner: Unique Ghimire)

Python scripts that turn OpenStreetMap trail data and published trek information into the
GeoJSON files in `data/routes/` that the web app loads.

## Setup (once)

```bash
# Windows (Python launcher)
py -3.12 -m venv .venv
.venv\Scripts\activate
# macOS / Linux
python3 -m venv .venv && source .venv/bin/activate

pip install -r requirements.txt
```

## Checks

```bash
ruff check .
pytest
```

## Layout

| Path | What it is |
| --- | --- |
| `prep/` | The Python package with the pipeline code |
| `prep/paths.py` | Folder locations shared by all scripts |
| `prep/schema.py` | Route file validator (`python -m prep.schema`) |
| `prep/overpass.py` | Cached, polite Overpass access; never runs in CI |
| `prep/build_route.py` | Spec → OSM ways → one simplified trail + stops → `data/routes/<id>.geojson` |
| `route-specs/` | One hand-written TOML spec per trek (start from `_template.toml`) |
| `tests/` | pytest tests |
| `cache/` | Overpass answers with their query and fetch date (committed, ODbL) |

## Rules

- Overpass API: one query at a time, a descriptive User-Agent, a modest timeout, results cached
  in `cache/`. Never run Overpass queries in CI.
- Every altitude in `data/routes/` must cite a published source in
  `data/routes/route-sources.md`. Never type in a number you cannot cite.

## Build a route

```bash
python -m prep.build_route everest-base-camp            # uses the cache, or asks Overpass once
python -m prep.build_route everest-base-camp --offline  # cache only; fails if it is missing
python -m prep.schema                                   # check every file in data/routes/
```

How it works and why: `docs/decisions.md` ADR-019. How to write a spec: `route-specs/README.md`.
