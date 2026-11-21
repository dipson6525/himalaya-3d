/**
 * cesiumSetup.ts — one-time CesiumJS configuration, imported first by main.tsx.
 * Owner: Sparsh Gorkhali. Related FR: FR1.
 *
 * 1. CESIUM_BASE_URL tells Cesium where vite.config.ts copied its static files.
 *    import.meta.env.BASE_URL is "/" in dev and "/himalaya-3d/" on GitHub Pages,
 *    so the same code works in both places.
 * 2. The ion token is read from import.meta.env.VITE_CESIUM_ION_TOKEN. It ends up inside
 *    the built JavaScript (that is unavoidable for a static site); the production token is
 *    protected by an "Allowed URLs" restriction set on cesium.com, not by hiding it.
 * 3. Nepal becomes Cesium's default view, before any Viewer is created (camera.ts).
 */
import { Ion } from 'cesium';
import { setNepalAsDefaultView } from './camera';

declare global {
  interface Window {
    CESIUM_BASE_URL: string;
  }
}

// "cesium/" must match `dest: 'cesium'` in vite.config.ts (the e2e test fails on any 404 if not).
window.CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium/`;

/** The Cesium ion token, or an empty string when none was provided at build time. */
const cesiumToken: string = import.meta.env.VITE_CESIUM_ION_TOKEN ?? '';

/** True when we can use Cesium ion services (World Terrain, world imagery). */
export const hasCesiumToken: boolean = cesiumToken.trim().length > 0;

if (hasCesiumToken) {
  Ion.defaultAccessToken = cesiumToken.trim();
}

setNepalAsDefaultView();
