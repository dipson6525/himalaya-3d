/**
 * screenshot.ts — helper for the e2e tests that save docs screenshots (only with UPDATE_SCREENSHOTS=1).
 * Owner: Sparsh Gorkhali (testing lead). Related: ADR-015.
 *
 * Cesium keeps downloading terrain and imagery tiles after the camera moves. A screenshot taken
 * too early shows a blurry, flat globe. Playwright's waitForLoadState('networkidle') does not
 * help here: once the page has been idle a single time it returns at once, even if the camera
 * flight has started new downloads since. So we watch the responses ourselves.
 */
import type { Page } from '@playwright/test';

/**
 * Wait until the page has received no network response for `quietMs` milliseconds,
 * but never longer than `maxMs` in total (so a busy network cannot hang the test).
 */
export async function waitForQuietNetwork(page: Page, quietMs = 2000, maxMs = 30_000) {
  let lastResponse = Date.now();
  const onResponse = () => {
    lastResponse = Date.now();
  };
  page.on('response', onResponse);
  const start = Date.now();
  while (Date.now() - lastResponse < quietMs && Date.now() - start < maxMs) {
    await page.waitForTimeout(250);
  }
  page.off('response', onResponse);
}

/** Let the 1.5 s camera flight finish, wait for the tiles it asked for, then save the picture. */
export async function saveScreenshot(page: Page, path: string) {
  await page.waitForTimeout(2000);
  await waitForQuietNetwork(page);
  await page.screenshot({ path });
}
