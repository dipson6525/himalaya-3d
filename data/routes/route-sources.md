# Route data sources

Every coordinate and altitude in `data/routes/*.geojson` must point to a source listed here
(by its **Source ID**). If two sources disagree by more than 50 m, or a published altitude
differs from Cesium World Terrain by more than 50 m, record it in the "Disagreements" table.

Owner: Unique Ghimire. Schema: see `docs/data-schema.md` (issue #6).

## Sources

| Source ID | Title / publisher | URL | Accessed (YYYY-MM-DD) | Licence | Used for |
| --- | --- | --- | --- | --- | --- |
| OSM | OpenStreetMap trail geometry, © OpenStreetMap contributors | https://www.openstreetmap.org/copyright | | ODbL 1.0 | Route lines |

_Add one row per book, map, government or park publication you take altitudes from._

Overpass answers are cached in `data-prep/cache/<route-id>-ways.json`. Each cache file records
the exact query, the date it was fetched (UTC) and the ODbL licence line, so every route line can
be traced back to the OpenStreetMap data it came from.

## Disagreements (> 50 m)

| Route | Stop | Source A (m) | Source B / terrain (m) | Difference (m) | Decision |
| --- | --- | --- | --- | --- | --- |
