/**
 * flythrough.spec.ts — the flythrough controls: Play / Pause (#19), Speed and jump to day (#20).
 * Owner: Sparsh Gorkhali (testing lead). Related FR: FR3.
 *
 * The camera maths (spline, constant speed, smoothed heading) and the controller's life cycle
 * are unit-tested in src/engine/flythrough/. Here we check, in the real build, that the controls
 * drive the controller: it prepares, plays (the distance flown grows), pauses, resumes from where
 * it stopped, flies faster at a higher speed, and jumps to the start of a day. Uses the SYNTHETIC
 * fixture routes. Screenshots only with UPDATE_SCREENSHOTS=1.
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

test('jump to the start of a day (#20)', async ({ page }) => {
  await serveFixtures(page);
  await page.goto('./');
  const status = page.getByTestId('route-status');
  await expect(status).toHaveAttribute('data-drawn-stops', '2', { timeout: 30_000 });
  await page.getByLabel('Choose a trek').selectOption('second-route');
  await expect(status).toHaveAttribute('data-drawn-stops', '3', { timeout: 30_000 });
  const toggle = page.getByTestId('flythrough-toggle');

  // One button per day that has a stage: day 2 (C → D) and day 4 (D → E; day 3 is a rest day).
  const days = page.getByRole('group', { name: 'Jump to the start of a day' });
  await expect(days.getByRole('button')).toHaveText(['Day 2', 'Day 4']);
  // Each button's full name for screen readers contains its visible text.
  await expect(days.getByRole('button').first()).toHaveAccessibleName('Jump to the start of day 2');

  // Jumping before Play: it prepares, then waits at the start of day 4 (at stop D).
  await days.getByRole('button', { name: 'Day 4' }).focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('data-status', 'paused', { timeout: 30_000 });
  await expect(toggle).toHaveText('Resume flythrough');
  // Stop D is 7,431 m along this almost straight trail; the camera stands there and the
  // "current point" is 600 m further: about 8,031 m.
  const jumped = Number(await toggle.getAttribute('data-distance'));
  expect(Math.abs(jumped - 8031)).toBeLessThan(5);
  // The day is highlighted too. (That StageLayer does NOT fly the camera away here is not
  // checked by a test: the camera is not visible to Playwright. See StageLayer's flyTo.)
  await expect(page.getByTestId('stop-list')).toHaveAttribute('data-drawn-stage', 'stop-e', {
    timeout: 30_000,
  });

  // Resume starts from there.
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-status', 'playing');
  await expect(toggle).toHaveAttribute('data-distance', String(jumped));

  // Jumping while playing keeps playing, from the new place: day 2 starts at stop C (0 m), so
  // the current point goes back to about 600 m, far below the 8,031 m of before.
  await days.getByRole('button', { name: 'Day 2' }).click();
  await expect(page.getByTestId('stop-list')).toHaveAttribute('data-drawn-stage', 'stop-d', {
    timeout: 30_000,
  });
  await expect(toggle).toHaveAttribute('data-status', 'playing');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-status', 'paused');
  expect(Number(await toggle.getAttribute('data-distance'))).toBeLessThan(jumped - 1000);
});

test('speed: 4× flies further than 0.5×, and a new trek gets the chosen speed (#20)', async ({
  page,
}) => {
  await serveFixtures(page);
  await page.goto('./');
  const status = page.getByTestId('route-status');
  await expect(status).toHaveAttribute('data-drawn-stops', '2', { timeout: 30_000 });
  const toggle = page.getByTestId('flythrough-toggle');
  const speed = page.getByLabel('Speed');
  await expect(speed.getByRole('option')).toHaveText(['0.5×', '1×', '2×', '4×']);
  await expect(speed).toHaveValue('1');

  // Choose 4× BEFORE changing trek: the new trek's controller must be given the speed.
  await speed.selectOption('4');
  await page.getByLabel('Choose a trek').selectOption('second-route');
  await expect(status).toHaveAttribute('data-drawn-stops', '3', { timeout: 30_000 });
  await expect(speed).toHaveValue('4');

  /** Play for 1.5 s, pause, and return the metres flown in that time. */
  async function flyFor1500ms(): Promise<number> {
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-status', 'playing', { timeout: 30_000 });
    const from = Number(await toggle.getAttribute('data-distance'));
    await page.waitForTimeout(1500);
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-status', 'paused');
    return Number(await toggle.getAttribute('data-distance')) - from;
  }

  const atFour = await flyFor1500ms();
  await speed.selectOption('0.5');
  const atHalf = await flyFor1500ms();
  // 4× is 8 times 0.5×. The frame rate changes how far each run gets (each frame counts at most
  // 0.1 s), so the test only asks for "more than 3 times as far".
  expect(atHalf).toBeGreaterThan(0);
  expect(atFour).toBeGreaterThan(3 * atHalf);
});
