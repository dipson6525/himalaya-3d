/**
 * flythrough.spec.ts — the flythrough's Play / Pause button (FR3, issue #19).
 * Owner: Sparsh Gorkhali (testing lead).
 *
 * The camera maths (spline, constant speed, smoothed heading) is unit-tested in
 * src/engine/flythrough/path.test.ts. Here we check, in the real build, that the button drives
 * the controller: it prepares, plays (the distance flown grows), pauses, and resumes from where
 * it stopped. Uses the SYNTHETIC fixture routes. Screenshots only with UPDATE_SCREENSHOTS=1.
 */
import { fileURLToPath } from 'node:url';
import { expect, test, type Locator } from '@playwright/test';
import { saveScreenshot } from './screenshot';
import { serveFixtures } from './serveFixtures';

const SCREENSHOT = fileURLToPath(
  new URL('../../docs/screenshots/m4-flythrough-synthetic.png', import.meta.url),
);

/** Metres flown so far, as reported by the controller at its last status change. */
async function distanceOf(toggle: Locator): Promise<number> {
  return Number(await toggle.getAttribute('data-distance'));
}

test('play, pause and resume the flythrough with the keyboard', async ({ page }) => {
  await serveFixtures(page);
  await page.goto('./');
  await expect(page.getByTestId('route-status')).toHaveAttribute('data-drawn-stops', '2', {
    timeout: 30_000,
  });

  const toggle = page.getByTestId('flythrough-toggle');
  await expect(toggle).toHaveText('Play flythrough');
  await toggle.focus();
  await page.keyboard.press('Enter');
  // "Preparing" samples the terrain once; then it plays.
  await expect(toggle).toHaveAttribute('data-status', 'playing', { timeout: 30_000 });
  await expect(toggle).toHaveText('Pause flythrough');

  await page.waitForTimeout(2000);
  await page.keyboard.press('Enter'); // focus is still on the button
  await expect(toggle).toHaveAttribute('data-status', 'paused');
  await expect(toggle).toHaveText('Resume flythrough');
  const firstStop = await distanceOf(toggle);
  // It moved. (How far depends on the frame rate: each frame counts at most 0.1 s, so a slow CI
  // machine moves less than 250 m/s × 2 s. We only check that it moved at all.)
  expect(firstStop).toBeGreaterThan(0);

  if (process.env.UPDATE_SCREENSHOTS === '1') {
    await saveScreenshot(page, SCREENSHOT); // paused, so the view stays still while tiles load
  }

  // Resume continues from where it stopped, not from the start: at the moment it starts
  // playing again, the reported distance is exactly where it paused.
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('data-status', 'playing');
  await expect(toggle).toHaveAttribute('data-distance', String(firstStop));
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('data-status', 'paused');
  expect(await distanceOf(toggle)).toBeGreaterThan(firstStop);
});

test('pressing a day pauses the flythrough; another trek stops it', async ({ page }) => {
  await serveFixtures(page);
  await page.goto('./');
  const status = page.getByTestId('route-status');
  await expect(status).toHaveAttribute('data-drawn-stops', '2', { timeout: 30_000 });

  const toggle = page.getByTestId('flythrough-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-status', 'playing', { timeout: 30_000 });

  // The day button flies the camera to that stage, so the flythrough must stop moving it.
  await page
    .getByTestId('stop-list')
    .getByRole('button', { name: /Day 2 · Test Stop B/ })
    .click();
  await expect(toggle).toHaveAttribute('data-status', 'paused');
  await expect(page.getByTestId('stop-list')).toHaveAttribute('data-drawn-stage', 'stop-b', {
    timeout: 30_000,
  });

  // Another trek gets its own flythrough, starting from the beginning.
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-status', 'playing');
  await page.getByLabel('Choose a trek').selectOption('second-route');
  await expect(status).toContainText('Showing Second Test Route');
  await expect(toggle).toHaveAttribute('data-status', 'idle');
  await expect(toggle).toHaveText('Play flythrough');
  await expect(toggle).toHaveAttribute('data-distance', '0');
});
