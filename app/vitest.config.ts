/**
 * vitest.config.ts — unit test settings (Vitest).
 * Owner: team. Related: all FRs (pure logic is tested here; the browser is tested by Playwright).
 *
 * Unit tests live next to the code they test (src/**\/name.test.ts) or, for checks that
 * span several modules (e.g. "en.json and ne.json have the same keys"), in tests/.
 * They run in plain Node — no browser and no Cesium — so they are fast and deterministic.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
