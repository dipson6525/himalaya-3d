/**
 * playwright.config.ts — end-to-end (browser) test settings.
 * Owner: Sparsh Gorkhali (testing lead, M7). Related: all FRs.
 *
 * Playwright starts `vite preview`, which serves the PRODUCTION build from dist/ under the
 * same "/himalaya-3d/" base path GitHub Pages uses — so these tests also catch base-path bugs.
 * Run `npm run e2e` (builds first) or, if dist/ is fresh, `npx playwright test`.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/himalaya-3d/`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    launchOptions: {
      // CI machines have no GPU. These flags let Chromium use SwiftShader (software WebGL),
      // which CesiumJS needs to create its 3D canvas.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
