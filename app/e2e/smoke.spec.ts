/**
 * smoke.spec.ts — M0 smoke test: the production build loads in a real browser.
 * Owner: Sparsh Gorkhali (testing lead). Related: FR1, NFR "credits and disclaimer visible".
 *
 * Runs against `vite preview`, i.e. the real build under the /himalaya-3d/ base path,
 * so it also catches the classic GitHub Pages bug where Cesium's workers/assets 404.
 */
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const SCREENSHOT = fileURLToPath(
  new URL('../../docs/screenshots/m0-app-shell.png', import.meta.url),
);

test('app shell loads with globe, credits and medical disclaimer', async ({ page }) => {
  const notFound: string[] = [];
  page.on('response', (response) => {
    if (response.status() === 404) notFound.push(response.url());
  });

  await page.goto('./');

  await expect(page.getByRole('heading', { level: 1, name: 'Himalaya 3D' })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('not medical advice');

  // Cesium adds a <canvas> once WebGL has started, and a credits area (must stay visible).
  await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.cesium-widget-credits')).toBeAttached();

  await page.waitForLoadState('networkidle');
  expect(notFound, 'no file may 404 (wrong base path?)').toEqual([]);

  await page.screenshot({ path: SCREENSHOT });
});
