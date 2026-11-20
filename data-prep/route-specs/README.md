# data-prep/route-specs/ — one spec per trek (owner: Unique Ghimire)

A route spec is the hand-written input for one trek: which OpenStreetMap ways make up the trail,
and the overnight stops with their cited altitudes. `prep/build_route.py` turns it into
`data/routes/<route-id>.geojson`.

## Make a new route

1. Copy `_template.toml` to `<route-id>.toml` (lowercase words joined by hyphens).
2. Find the trail on https://www.openstreetmap.org: if there is a hiking **route relation** for
   the trek, put its id in `osm_relation`; otherwise list the **way** ids in `osm_ways`.
3. Fill in each stop. Take every altitude from a published source, add that source to the table
   in `data/routes/route-sources.md`, and put its Source ID in `altitude_source`.
4. Run, inside `data-prep/` with the venv active:

   ```bash
   python -m prep.build_route <route-id>
   ```

   The first run asks Overpass once and saves the answer in `data-prep/cache/<route-id>-ways.json`.
   Commit that file. Later runs (and `--offline`) use it.
5. If the build says the ways form several separate pieces, a way is missing (or a side path was
   included). Fix the list of ways; never draw the missing part by hand.

## Rules

- One route per run; Overpass is never called in CI.
- Files starting with `_` are templates and are never built.
