/**
 * profile.spec.ts — the elevation profile strip under the globe (FR4, issue #21; NFR4 tablet).
 * Owner: Dipson Gurung. Related: ui-design (profile strip), NFR6 (disclaimer stays visible).
 *
 * Uses the SYNTHETIC fixture routes. The strip behaves differently with and without a Cesium
 * token, and each test checks the case it is running in:
 * - with a token (local runs): heights from World Terrain → totals, chart, data note, Hide / Show;
 * - without one (CI): no terrain → only the notice, and no numbers and no chart at all.
 * The ascent / descent maths is unit-tested in src/features/elevation/profile.test.ts, and the
 * failure paths of the sampling in sampleHeights.test.ts.
 * Screenshots only with UPDATE_SCREENSHOTS=1.
 */
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { saveScreenshot } from './screenshot';
import { serveFixtures } from './serveFixtures';

const SCREENSHOT = fileURLToPath(
  new URL('../../docs/screenshots/m4-elevation-profile-synthetic.png', import.meta.url),
);
const NO_TERRAIN_NOTICE =
  'No terrain without a Cesium ion token, so there is no elevation profile.';

/** Open the app with the fixtures and wait until the strip has finished sampling. */
async function openProfile(page: Page) {
  await serveFixtures(page);
  await page.goto('./');
  const strip = page.getByTestId('elevation-profile');
  await expect(strip).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  const noTerrain = (await strip.getAttribute('data-no-terrain')) === 'true';
  return { strip, noTerrain };
}

test('elevation profile: totals and chart with terrain; only a notice without (#21)', async ({
  page,
}) => {
  const { strip, noTerrain } = await openProfile(page);
  await expect(strip.getByRole('heading', { name: 'Elevation profile' })).toBeVisible();

  if (noTerrain) {
    // No token: say so, and show no numbers (they would be untrue) and no chart.
    await expect(strip.getByRole('status')).toHaveText(NO_TERRAIN_NOTICE);
    await expect(strip).not.toContainText('Total ascent');
    await expect(strip.getByRole('img')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toContainText('not medical advice');
    return;
  }

  // Test Route is 22,641.3 m long; samples at most 50 m apart: ceil(22,641.3 / 50) = 453
  // equal intervals, so 454 samples.
  await expect(strip).toHaveAttribute('data-samples', '454');
  // The chart is a canvas, so it carries a text summary for screen readers.
  const chart = strip.getByRole('img', {
    name: /^Elevation profile of Test Route: 22\.\d km long/,
  });
  await expect(chart).toBeVisible();
  await expect(strip.getByRole('status')).toHaveText(
    /^Total ascent [\d,]+ m · Total descent [\d,]+ m · Highest terrain point [\d,]+ m at [\d.]+ km$/,
  );
  // Honest about the data: terrain heights, not the cited stop altitudes.
  await expect(strip).toContainText('not the cited stop altitudes');

  if (process.env.UPDATE_SCREENSHOTS === '1') {
    await saveScreenshot(page, SCREENSHOT);
  }

  // Hide / Show, with aria-expanded telling screen readers which it is.
  await strip.getByRole('button', { name: 'Hide profile' }).click();
  await expect(chart).toBeHidden();
  await expect(strip.getByRole('status')).toContainText('Total ascent'); // totals stay visible
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

test('tablet width, 768 px (NFR4): chart starts hidden, globe and disclaimer stay visible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const { strip, noTerrain } = await openProfile(page);
  const globe = page.locator('.globe-area');
  const disclaimer = page.getByRole('contentinfo');

  // The status line is in the header, so it shows even while the chart is hidden.
  await expect(strip.getByRole('status')).toBeVisible();
  await expect(disclaimer).toBeInViewport();

  if (!noTerrain) {
    const show = strip.getByRole('button', { name: 'Show profile' }); // starts hidden here
    await expect(show).toHaveAttribute('aria-expanded', 'false');
    await show.click();
    await expect(strip.getByRole('img')).toBeVisible();
  }
  // Even with the chart open, the globe keeps a usable height and the disclaimer stays visible.
  const box = await globe.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(199);
  await expect(disclaimer).toBeInViewport();
});
