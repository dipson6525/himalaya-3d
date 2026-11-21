# Published stop altitudes vs Cesium World Terrain (NFR9)

Owner: Unique Ghimire · Issues #13, #31 · Proposal section 3.8 ("Route altitudes will be
compared with published values for each stop.")

## How to fill this in

- **Published altitude** and **Source ID** come from the route file (`data/routes/<route>.geojson`)
  and `data/routes/route-sources.md`. Never type an altitude that is not in a cited source.
- **Cesium terrain height** comes from the cross-check in issue #13 (`sampleTerrainMostDetailed`
  at the stop's position, run locally with the Cesium token). Paste the value the tool prints.
- **Difference** = terrain − published. Mark rows where |difference| > 50 m and write a decision in
  the Disagreements table of `route-sources.md` (for example: the stop marker is on a slope; the
  source rounds; a second source agrees with terrain).

## Results

| Route | Stop id | Published altitude (m) | Source ID | Cesium terrain height (m) | Difference (m) | > 50 m? | Note / decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |

Add one row per stop of every route. Tool output: `docs/testing/altitude-check-<date>.txt`
(commit it next to this table).

## Summary (fill in after all rows)

- Stops compared: 
- Stops with |difference| > 50 m: 
- Largest difference and the reason: 
