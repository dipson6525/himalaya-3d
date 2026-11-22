/**
 * routes.spec.ts — the route layer draws a route served from data/routes/ (FR2, issue #15).
 * Owner: Sparsh Gorkhali (testing lead).
 *
 * Real route files do not exist yet (issues #9–#12), so this test intercepts the two requests the
 * app makes and answers them with the SYNTHETIC fixture in e2e/fixtures/ ("Test Route").
 * Screenshots are written only with UPDATE_SCREENSHOTS=1 (ADR-015).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf-8');

const SCREENSHOT = fileURLToPath(
  new URL('../../docs/screenshots/m3-route-layer-synthetic.png', import.meta.url),
);

test('shows the selected route and counts its stops (synthetic fixture)', async ({ page }) => {
  await page.route('**/data/routes/index.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: fixture('index.json') }),
  );
  await page.route('**/data/routes/test-route.geojson', (route) =>
    route.fulfill({ contentType: 'application/geo+json', body: fixture('test-route.geojson') }),
  );

  await page.goto('./');
  await expect(page.getByTestId('route-status')).toHaveText(
    'Showing Test Route: 2 overnight stops. Click a marker for details.',
  );
  await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30_000 });
  // RouteLayer reports the markers it really added to the globe (not just what the data says).
  await expect(page.getByTestId('route-status')).toHaveAttribute('data-drawn-stops', '2', {
    timeout: 30_000,
  });

  if (process.env.UPDATE_SCREENSHOTS === '1') {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500); // let the 1.5 s camera flight to the route finish
    await page.screenshot({ path: SCREENSHOT });
  }
});

test('says so when the route list cannot be loaded', async ({ page }) => {
  await page.route('**/data/routes/index.json', (route) => route.fulfill({ status: 500 }));
  await page.goto('./');
  await expect(page.getByTestId('route-status')).toContainText('Could not load the trek data');
});

test('says so when the route file itself is missing', async ({ page }) => {
  await page.route('**/data/routes/index.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: fixture('index.json') }),
  );
  await page.route('**/data/routes/test-route.geojson', (route) => route.fulfill({ status: 404 }));
  await page.goto('./');
  await expect(page.getByTestId('route-status')).toContainText('Could not load the trek data');
  await expect(page.getByRole('contentinfo')).toContainText('not medical advice'); // page still intact
});
