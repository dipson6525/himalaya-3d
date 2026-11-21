# e2e/fixtures/

Synthetic test data for the Playwright tests. **Not real trek data**: the names say "Test", the
positions are round numbers near 85 °E 28 °N, and the altitudes are made up. The tests serve these
files in place of `data/routes/` (with `page.route`), so drawing can be tested before real routes
exist. Never copy anything from here into `data/routes/`.
