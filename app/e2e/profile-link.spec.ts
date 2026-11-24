/**
 * profile-link.spec.ts — the elevation profile linked to the map (FR4, issue #22).
 * Owner: Dipson Gurung.
 *
 * The globe is a canvas, so the tests read the marker's state from a hidden status element
 * (data-testid="hover-marker") and the chart's from the strip (data-highlight-m).
 * Each test runs in the mode where it can be exact:
 * - chart → map needs a chart, so it runs with a Cesium token (local runs);
 * - map → chart clicks the trail at the centre of the globe. After the camera flies to Test Route,
 *   the trail's middle point (85.1 °E, 28.05 °N, about 11.3 km along) is exactly at the centre
 *   when there is no terrain (CI). With terrain the trail is draped over the mountains and its
 *   place on the screen cannot be predicted from outside, so that test runs without a token.
 * Uses the SYNTHETIC fixture routes. Screenshots only with UPDATE_SCREENSHOTS=1.
 */
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { saveScreenshot } from './screenshot';
import { serveFixtures } from './serveFixtures';

const SCREENSHOT = fileURLToPath(
  new URL('../../docs/screenshots/m4-profile-map-link-synthetic.png', import.meta.url),
);

/** Open the app and wait for the profile; tells whether there is terrain. */
async function open(page: Page) {
  await serveFixtures(page);
  await page.goto('./');
  await expect(page.getByTestId('route-status')).toHaveAttribute('data-drawn-stops', '2', {
    timeout: 30_000,
  });
  const strip = page.getByTestId('elevation-profile');
  await expect(strip).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  const noTerrain = (await strip.getAttribute('data-no-terrain')) === 'true';
  return { strip, marker: page.getByTestId('hover-marker'), noTerrain };
}

test('chart → map: pointing at the chart puts a marker on the trail (with terrain)', async ({
  page,
}) => {
  const { strip, marker, noTerrain } = await open(page);
  test.skip(noTerrain, 'needs a Cesium token: without terrain there is no chart');

  const chart = strip.getByRole('img', { name: /^Elevation profile of Test Route/ });
  const box = await chart.boundingBox();
  if (!box) throw new Error('the chart has no size');
  await expect(marker).toHaveAttribute('data-shown', 'false');

  // Point at the middle of the chart: a distance is highlighted on the chart AND on the globe.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(marker).toHaveAttribute('data-shown', 'true');
  const onChart = Number(await strip.getAttribute('data-highlight-m'));
  expect(onChart).toBeGreaterThan(0);
  expect(onChart).toBeLessThan(22_642); // inside the trail (22,641.3 m)
  await expect(marker).toHaveAttribute('data-distance', String(onChart));
  if (process.env.UPDATE_SCREENSHOTS === '1') {
    await saveScreenshot(page, SCREENSHOT); // the mouse stays on the chart meanwhile
  }

  // Further right → further along the trail.
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await expect
    .poll(async () => Number(await strip.getAttribute('data-highlight-m')))
    .toBeGreaterThan(onChart);

  // Leaving the chart clears the highlight on both.
  await page.mouse.move(5, 5);
  await expect(marker).toHaveAttribute('data-shown', 'false');
  await expect(strip).toHaveAttribute('data-highlight-m', '');
});

test('map → chart: clicking the trail marks that distance (without terrain)', async ({ page }) => {
  const { strip, marker, noTerrain } = await open(page);
  test.skip(!noTerrain, 'the draped trail cannot be found on screen from outside with terrain');

  await page.waitForTimeout(2500); // let the 1.5 s camera flight to the route finish
  const globe = await page.locator('.cesium-widget canvas').boundingBox();
  if (!globe) throw new Error('the globe has no size');
  await page.mouse.click(globe.x + globe.width / 2, globe.y + globe.height / 2);

  // The middle point of Test Route is about 11.3 km along its 22.6 km.
  await expect(marker).toHaveAttribute('data-shown', 'true');
  const distance = Number(await marker.getAttribute('data-distance'));
  expect(distance).toBeGreaterThan(9_000);
  expect(distance).toBeLessThan(13_500);
  // The strip holds the same highlight (it would draw it on the chart when there is terrain).
  await expect(strip).toHaveAttribute('data-highlight-m', String(distance));

  // Another trek starts with nothing highlighted.
  await page.getByLabel('Choose a trek').selectOption('second-route');
  await expect(marker).toHaveAttribute('data-shown', 'false');
});
