/**
 * trek-selector.spec.ts — choosing a trek and moving between side-panel tabs (FR2, issue #16).
 * Owner: Dipson Gurung (UI). Related: NFR11 (keyboard use), docs/ui-design.md rule 6.
 *
 * Like routes.spec.ts, this serves the SYNTHETIC fixtures in e2e/fixtures/ in place of
 * data/routes/ ("Test Route" with 2 stops, "Second Test Route" with 3). Everything is done with
 * the keyboard, because "keyboard accessible" is an acceptance criterion of #16.
 * Screenshots are written only with UPDATE_SCREENSHOTS=1 (ADR-015).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf-8');

const SCREENSHOT = fileURLToPath(
  new URL('../../docs/screenshots/m3-trek-selector-synthetic.png', import.meta.url),
);

/**
 * Answer data/routes/ requests from the fixtures. Files named in `missing` get a 404.
 * Returns a counter of how often each route file was downloaded.
 */
async function serveFixtures(page: Page, missing: string[] = []) {
  const downloads: Record<string, number> = {};
  await page.route('**/data/routes/*', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    downloads[name] = (downloads[name] ?? 0) + 1;
    if (missing.includes(name)) return route.fulfill({ status: 404 });
    const type = name.endsWith('.json') ? 'application/json' : 'application/geo+json';
    return route.fulfill({ contentType: type, body: fixture(name) });
  });
  return downloads;
}

test('choose another trek with the keyboard; the stop list and globe follow', async ({ page }) => {
  const downloads = await serveFixtures(page);
  await page.goto('./');

  const status = page.getByTestId('route-status');
  const stops = page.getByRole('list').filter({ hasText: 'Test Stop' }).getByRole('listitem');
  await expect(status).toHaveText(
    'Showing Test Route: 2 overnight stops. Click a marker for details.',
  );
  await expect(stops).toHaveText([
    'Day 1 · Test Stop A · 1,000 m',
    'Day 2 · Test Stop B · 1,500 m',
  ]);

  // The selector has a visible label, so getByLabel finds it the way a screen reader would.
  const selector = page.getByLabel('Choose a trek');
  await expect(selector.getByRole('option')).toHaveText(['Test Route', 'Second Test Route']);
  await selector.focus();
  await page.keyboard.press('ArrowDown'); // a closed native <select> changes on ArrowDown

  await expect(selector).toHaveValue('second-route');
  await expect(status).toHaveText(
    'Showing Second Test Route: 3 overnight stops. Click a marker for details.',
  );
  await expect(stops).toHaveText([
    'Day 1 · Test Stop C · 2,000 m',
    'Day 2 · Test Stop D · 2,500 m',
    'Day 4 · Test Stop E · 3,000 m',
  ]);
  await expect(page.locator('.cesium-widget canvas')).toBeVisible({ timeout: 30_000 });
  await expect(status).toHaveAttribute('data-drawn-stops', '3', { timeout: 30_000 });

  if (process.env.UPDATE_SCREENSHOTS === '1') {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500); // let the 1.5 s camera flight to the route finish
    await page.screenshot({ path: SCREENSHOT });
  }

  // Back to the first trek: it comes from the cache, so it is not downloaded a second time.
  await page.keyboard.press('ArrowUp');
  await expect(status).toHaveText(
    'Showing Test Route: 2 overnight stops. Click a marker for details.',
  );
  await expect(status).toHaveAttribute('data-drawn-stops', '2', { timeout: 30_000 });
  expect(downloads['test-route.geojson']).toBe(1);
});

test('a trek that fails to load clears the map instead of showing the old trek', async ({
  page,
}) => {
  await serveFixtures(page, ['second-route.geojson']);
  await page.goto('./');

  const status = page.getByTestId('route-status');
  await expect(status).toHaveAttribute('data-drawn-stops', '2', { timeout: 30_000 });

  await page.getByLabel('Choose a trek').selectOption('second-route');
  await expect(status).toContainText('Could not load the trek data');
  await expect(status).toHaveAttribute('data-drawn-stops', '0');
  await expect(page.getByText('Test Stop A')).toHaveCount(0); // old stop list is gone too
  await expect(page.getByRole('contentinfo')).toContainText('not medical advice');

  // The selector still works, so the user can go back to a trek that loads.
  await page.getByLabel('Choose a trek').selectOption('test-route');
  await expect(status).toHaveAttribute('data-drawn-stops', '2', { timeout: 30_000 });
});

test('side-panel tabs follow the WAI-ARIA tabs pattern', async ({ page }) => {
  await serveFixtures(page);
  await page.goto('./');

  const tablist = page.getByRole('tablist', { name: 'Side panel sections' });
  const tab = (name: string) => tablist.getByRole('tab', { name });
  await expect(tablist.getByRole('tab')).toHaveText(['Trek', 'Plan', 'Layers']);
  await expect(tab('Trek')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Trek' })).toBeVisible();

  // Only the selected tab is a Tab-key stop.
  await expect(tab('Trek')).toHaveAttribute('tabindex', '0');
  await expect(tab('Plan')).toHaveAttribute('tabindex', '-1');

  await tab('Trek').focus();
  const expectSelected = async (name: string) => {
    await expect(tab(name)).toBeFocused();
    await expect(tab(name)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name })).toBeVisible();
  };

  await page.keyboard.press('ArrowRight');
  await expectSelected('Plan');
  await expect(page.getByRole('tabpanel', { name: 'Plan' })).toContainText('issue #24');
  await expect(page.getByRole('tabpanel', { name: 'Trek' })).toBeHidden();

  await page.keyboard.press('End');
  await expectSelected('Layers');
  await page.keyboard.press('ArrowRight'); // wraps round to the first tab
  await expectSelected('Trek');
  await page.keyboard.press('ArrowLeft'); // wraps round to the last tab
  await expectSelected('Layers');
  await page.keyboard.press('Home');
  await expectSelected('Trek');

  // The Trek panel kept its state while hidden (it is hidden, not removed).
  await expect(page.getByTestId('route-status')).toContainText('Showing Test Route');

  // Tab leaves the tab row and goes into the panel, to the trek selector.
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Choose a trek')).toBeFocused();
});
