---
name: route-data
description: How to fetch OSM trail geometry via Overpass (cached, one query at a time), clean and simplify it with Python, write data/routes/*.geojson matching docs/data-schema.md, and cite every altitude in data/routes/route-sources.md. Use for any task that adds or changes route or stop data.
---

# Route data workflow (owner: Unique Ghimire)

Use this whenever you add a route, add/edit a stop, or touch `data-prep/` or `data/routes/`.

## Golden rules

1. **Never invent a number.** Every altitude, coordinate and distance must come from a cited
   source or from a script run whose output you can show. Unknown → `TODO(team): verify`
   in the data AND a line in `docs/OPEN_QUESTIONS.md`.
2. **Overpass is a shared, free service.** One query at a time, a descriptive User-Agent,
   `[timeout:60]` or less, and always check `data-prep/cache/` first. Never call Overpass in CI.
3. **Licence:** OSM data is ODbL. Keep "© OpenStreetMap contributors" in the map credits,
   README and `route-sources.md`.

## Steps

1. **Check the schema** in `docs/data-schema.md`. Each stop needs `kind`, `id`, `name_en`,
   `name_ne`, `day`, `altitude_m`, `altitude_source`, `description_en`, `description_ne`; its
   position is the Point geometry `[lon, lat]`. Validate with `python -m prep.schema`.
2. **Activate the venv:** `cd data-prep` then `.venv\Scripts\activate` (Windows) or
   `source .venv/bin/activate`.
3. **Write the route spec:** copy `data-prep/route-specs/_template.toml` to `<route-id>.toml`;
   give the OSM route relation id OR the list of way ids, and the stops (with lon/lat and a
   cited `altitude_source`). See `data-prep/route-specs/README.md`.
4. **Build:** `python -m prep.build_route <route-id>`. It asks Overpass at most once (cached in
   `data-prep/cache/<route-id>-ways.json`, which you commit), merges the ways, simplifies in
   metres (ADR-019, default 5 m), checks the schema and writes `data/routes/<route-id>.geojson`.
   - "N separate pieces" means a way is missing or a side path is included: fix the way list,
     never draw the gap by hand.
   - HTTP 429/504 from Overpass: wait and run again by hand later; never loop.
   - Use `--offline` to make sure only the cache is used.
5. **Do not hand-edit** `data/routes/*.geojson`; change the spec and rebuild.
6. **Cite sources:** add every publication used to the Sources table in
   `data/routes/route-sources.md` and reference its Source ID from each stop.
7. **Cross-check altitudes** against Cesium World Terrain (issue #13). Differences > 50 m go
   into the Disagreements table with a decision — never silently "fix" a number.
8. **Test:** `ruff check .` and `pytest` (the schema validator test must pass for every file).
9. **Nepali text** (`name_ne`, `description_ne`): if machine-drafted, list it in
   `docs/i18n-review.md` as "needs review".

## Definition of done

- GeoJSON validates; pytest + ruff green.
- Every stop cites a source; disagreements table updated.
- `docs/PROGRESS.md` entry and `docs/viva/unique-ghimire.md` updated (use the viva-notes skill).
