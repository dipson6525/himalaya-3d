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
| `tests/` | pytest tests |
| `cache/` | Raw Overpass responses (committed, ODbL) |

## Rules

- Overpass API: one query at a time, a descriptive User-Agent, a modest timeout, results cached
  in `cache/`. Never run Overpass queries in CI.
- Every altitude in `data/routes/` must cite a published source in
  `data/routes/route-sources.md`. Never type in a number you cannot cite.
