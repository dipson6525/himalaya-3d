/**
 * smoke.spec.ts — smoke test: the production build loads in a real browser (M0, extended in #14).
 * Owner: Sparsh Gorkhali (testing lead). Related: FR1, NFR5 (credits visible), NFR6 (disclaimer).
 *
 * Runs against `vite preview`, i.e. the real build under the /himalaya-3d/ base path,
 * so it also catches the classic GitHub Pages bug where Cesium's workers/assets 404.
 *
 * Screenshots for docs/screenshots/ are only written when UPDATE_SCREENSHOTS=1 is set,
 * so a normal test run never changes committed files (ADR-015).
 */
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const SCREENSHOT = fileURLToPath(
  new URL('../../docs/screenshots/m3-nepal-start-view.png', import.meta.url),
);

test('app shell loads with globe, credits and medical disclaimer', async ({ page }) => {
  const notFound: string[] = [];
  page.on('response', (response) => {
    if (response.status() === 404) notFound.push(response.url());
  });

  await page.goto('./');

  await expect(page.getByRole('heading', { level: 1, name: 'Himalaya 3D' })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('not medical advice');
  // data/routes/index.json is real but empty until the route issues (#9–#12) add treks.
  await expect(page.getByTestId('route-status')).toContainText('No trek data yet');

  // Cesium adds a <canvas> once WebGL has started, and a credits area that must stay visible.
  await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.cesium-widget-credits')).toBeVisible();
  // Our OpenStreetMap credit must be ON the map (showOnScreen), not only in the pop-up (NFR5).
  await expect(page.locator('.cesium-credit-textContainer')).toContainText(
    'OpenStreetMap contributors',
  );

  await page.waitForLoadState('networkidle');
  expect(notFound, 'no file may 404 (wrong base path?)').toEqual([]);

  if (process.env.UPDATE_SCREENSHOTS === '1') {
    await page.screenshot({ path: SCREENSHOT });
  }
});
