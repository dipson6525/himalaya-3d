/**
 * serveFixtures.ts — answer the app's data/routes/ requests with the SYNTHETIC files in
 * e2e/fixtures/ (Test Route, Second Test Route). Used by the e2e tests that need route data
 * before the real routes (#9–#12) exist.
 * Owner: Sparsh Gorkhali (testing lead).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

/** The text of one fixture file. */
export const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf-8');

/**
 * Serve data/routes/* from the fixtures. Files named in `missing` get a 404.
 * Returns a counter of how often each file was downloaded.
 */
export async function serveFixtures(page: Page, missing: string[] = []) {
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
