/**
 * vite.config.ts — build settings for the Himalaya 3D front end.
 * Owner: Sparsh Gorkhali (engine / performance). Related: NFR "deploys as a static site".
 *
 * Three things matter here:
 * 1. `base` — GitHub Pages serves the site from https://<user>.github.io/himalaya-3d/,
 *    so production builds must prefix every asset URL with "/himalaya-3d/".
 *    The dev server and unit tests use "/".
 * 2. Cesium's static files (web workers, images, CSS, third-party code) are not bundled
 *    by Vite. We copy them into "<base>cesium/" and tell Cesium where they are with
 *    window.CESIUM_BASE_URL (see src/engine/cesiumSetup.ts). If the two paths disagree,
 *    workers 404 and the globe never appears.
 * 3. `envDir` — our .env.local lives in the project root (one folder above app/), so we
 *    point Vite there. Only variables whose names start with VITE_ reach the browser.
 */
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/** Where the npm "cesium" package keeps its pre-built static files. */
const CESIUM_BUILD = 'node_modules/cesium/Build/Cesium';

/** The project root (parent of app/), where .env.local lives. */
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Sub-folders of Cesium's build that must be served next to our app. */
const CESIUM_FOLDERS = ['Workers', 'ThirdParty', 'Assets', 'Widgets'];

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/himalaya-3d/' : '/',
  envDir: PROJECT_ROOT,
  plugins: [
    react(),
    viteStaticCopy({
      // Copies e.g. node_modules/cesium/Build/Cesium/Workers/** to dist/cesium/Workers/**.
      // stripBase: 4 removes the "node_modules/cesium/Build/Cesium" prefix from each path.
      targets: CESIUM_FOLDERS.map((folder) => ({
        src: `${CESIUM_BUILD}/${folder}/**/*`,
        dest: 'cesium', // must match CESIUM_BASE_URL in src/engine/cesiumSetup.ts
        rename: { stripBase: 4 },
      })),
    }),
  ],
  build: {
    // CesiumJS alone is several MB minified; the default 500 kB warning is not useful for us.
    // Load time is measured separately (issue #30), not guessed from this number.
    chunkSizeWarningLimit: 6000,
  },
}));
