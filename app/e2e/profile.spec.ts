/**
 * profile.spec.ts — the elevation profile strip under the globe (FR4, issue #21).
 * Owner: Dipson Gurung. Related: ui-design (profile strip), NFR6 (disclaimer stays visible).
 *
 * Uses the SYNTHETIC fixture routes. Works with and without a Cesium token: with one, the heights
 * come from World Terrain; without one (CI), there is no terrain, every height is 0 m and the
 * strip says so. The checks below hold either way. The ascent / descent maths is unit-tested in
 * src/features/elevation/profile.test.ts. Screenshots only with UPDATE_SCREENSHOTS=1.
 */
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { saveScreenshot } from './screenshot';
import { serveFixtures } from './serveFixtures';

const SCREENSHOT = fileURLToPath(
  new URL('../../docs/screenshots/m4-elevation-profile-synthetic.png', import.meta.url),
);

test('elevation profile: chart, totals, data source and Hide / Show (#21)', async ({ page }) => {
  await serveFixtures(page);
  await page.goto('./');

  const strip = page.getByTestId('elevation-profile');
  await expect(strip).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  // Test Route is 22,641.3 m long; samples at most 50 m apart: ceil(22,641.3 / 50) = 453
  // equal intervals, so 454 samples (the same with or without terrain).
  await expect(strip).toHaveAttribute('data-samples', '454');

  await expect(strip.getByRole('heading', { name: 'Elevation profile' })).toBeVisible();
  // The chart is a canvas, so it carries a text summary for screen readers.
  const chart = strip.getByRole('img', {
    name: /^Elevation profile of Test Route: 22\.\d km long/,
  });
  await expect(chart).toBeVisible();
  await expect(strip).toContainText(
    /Total ascent [\d,]+ m · Total descent [\d,]+ m · Highest point [\d,]+ m at [\d.]+ km/,
  );
  // Honest about the data: terrain heights, not the cited stop altitudes.
  await expect(strip).toContainText('not the cited stop altitudes');

  if (process.env.UPDATE_SCREENSHOTS === '1') {
    await saveScreenshot(page, SCREENSHOT);
  }

  // Hide / Show, with aria-expanded telling screen readers which it is.
  await strip.getByRole('button', { name: 'Hide profile' }).click();
  await expect(chart).toBeHidden();
  const show = strip.getByRole('button', { name: 'Show profile' });
  await expect(show).toHaveAttribute('aria-expanded', 'false');
  await show.click();
  await expect(chart).toBeVisible();

  // Another trek gets its own profile; the medical disclaimer is still on screen.
  await page.getByLabel('Choose a trek').selectOption('second-route');
  await expect(
    strip.getByRole('img', { name: /^Elevation profile of Second Test Route: 14\.\d km long/ }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('contentinfo')).toContainText('not medical advice');
});
