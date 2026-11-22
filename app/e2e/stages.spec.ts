/**
 * stages.spec.ts — daily stages: pressing a day highlights the trail walked that day (FR2, #49).
 * Owner: Sparsh Gorkhali (testing lead).
 *
 * Uses the SYNTHETIC "Second Test Route" fixture: stops C (day 1), D (day 2), E (day 4) on the
 * trail's three points. Each stage is the haversine distance between two of those points:
 * C→D = 7.431 km and D→E = 7.430 km, so both show as "7.4 km". (Check one by hand with the
 * worked example in src/lib/geo/distance.ts.)
 * Screenshots are written only with UPDATE_SCREENSHOTS=1 (ADR-015).
 */
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { saveScreenshot } from './screenshot';
import { serveFixtures } from './serveFixtures';

const SCREENSHOT = fileURLToPath(
  new URL('../../docs/screenshots/m3-daily-stage-synthetic.png', import.meta.url),
);

test('pressing a day highlights its stage; pressing again or changing trek removes it', async ({
  page,
}) => {
  await serveFixtures(page);
  await page.goto('./');
  const status = page.getByTestId('route-status');
  await expect(status).toHaveAttribute('data-drawn-stops', '2', { timeout: 30_000 });
  await page.getByLabel('Choose a trek').selectOption('second-route');
  await expect(status).toHaveAttribute('data-drawn-stops', '3', { timeout: 30_000 });

  const list = page.getByTestId('stop-list');
  const day2 = list.getByRole('button', { name: /Day 2 · Test Stop D/ });
  const day4 = list.getByRole('button', { name: /Day 4 · Test Stop E/ });

  // The first stop starts the trek: no stage, so no button. The others show a computed length.
  await expect(list.getByRole('button')).toHaveCount(2);
  await expect(day2).toContainText('7.4 km along the trail from the previous stop');
  await expect(day4).toContainText('7.4 km along the trail from the previous stop');
  await expect(day2).toHaveAttribute('aria-pressed', 'false');

  // Keyboard only: from the trek selector, Tab reaches the first day button; Enter presses it.
  await page.getByLabel('Choose a trek').focus();
  await page.keyboard.press('Tab');
  await expect(day2).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(day2).toHaveAttribute('aria-pressed', 'true');
  await expect(list).toHaveAttribute('data-drawn-stage', 'stop-d', { timeout: 30_000 });

  if (process.env.UPDATE_SCREENSHOTS === '1') {
    await saveScreenshot(page, SCREENSHOT);
  }

  // Another day moves the highlight; only one day is pressed at a time.
  await day4.click();
  await expect(day4).toHaveAttribute('aria-pressed', 'true');
  await expect(day2).toHaveAttribute('aria-pressed', 'false');
  await expect(list).toHaveAttribute('data-drawn-stage', 'stop-e');

  // Pressing the same day again removes the highlight.
  await day4.click();
  await expect(day4).toHaveAttribute('aria-pressed', 'false');
  await expect(list).toHaveAttribute('data-drawn-stage', '');

  // A highlighted stage belongs to its trek: choosing another trek removes it.
  await day4.click();
  await expect(list).toHaveAttribute('data-drawn-stage', 'stop-e');
  await page.getByLabel('Choose a trek').selectOption('test-route');
  await expect(status).toContainText('Showing Test Route');
  await expect(list).toHaveAttribute('data-drawn-stage', '');
  await expect(list.getByRole('button', { pressed: true })).toHaveCount(0);

  // …and it does not come back when the user returns to the first trek (served from the cache).
  await page.getByLabel('Choose a trek').selectOption('second-route');
  await expect(status).toContainText('Showing Second Test Route');
  await expect(list.getByRole('button', { pressed: true })).toHaveCount(0);
  await expect(list).toHaveAttribute('data-drawn-stage', '');
});
