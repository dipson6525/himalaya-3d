# data-prep/cache/

Raw responses from the Overpass API (OpenStreetMap), saved by the data-prep scripts.

- Committed to git on purpose, so nobody has to query Overpass again (one query at a time,
  never in CI — see CLAUDE.md "Gotchas").
- Contents are OpenStreetMap data © OpenStreetMap contributors, licensed under the
  Open Database License (ODbL): https://www.openstreetmap.org/copyright
- File names describe the query, e.g. `ebc-trail-ways.json`.
