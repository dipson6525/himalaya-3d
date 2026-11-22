# e2e/fixtures/

Synthetic test data for the Playwright tests. **Not real trek data**: the names say "Test", the
positions are round numbers near 85–86 °E 27.5–28 °N, and the altitudes are made up. The tests serve these
files in place of `data/routes/` (with `page.route`), so drawing can be tested before real routes
exist. Never copy anything from here into `data/routes/`.

| File                   | Route                     | Stops                  |
| ---------------------- | ------------------------- | ---------------------- |
| `index.json`           | lists both routes below   |                        |
| `test-route.geojson`   | Test Route (85 °E)        | A, B (days 1, 2)       |
| `second-route.geojson` | Second Test Route (86 °E) | C, D, E (days 1, 2, 4) |
