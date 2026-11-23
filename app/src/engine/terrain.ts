/**
 * terrain.ts — wait for Cesium's terrain before asking it for heights.
 * Owner: Sparsh Gorkhali. Used by the flythrough (#19) and the elevation profile (#21).
 */
import type { TerrainProvider, Viewer } from 'cesium';

/** How long to wait for World Terrain to finish loading, in milliseconds. */
export const TERRAIN_WAIT_MS = 20_000;

/**
 * The terrain provider, once it exists. With World Terrain, Cesium leaves
 * viewer.terrainProvider undefined until the terrain has finished loading (a few seconds after
 * start-up), so a user who presses Play early must wait for globe.terrainProviderChanged.
 * Gives up after TERRAIN_WAIT_MS (the caller then shows its error line).
 */
export function terrainReady(viewer: Viewer): Promise<TerrainProvider> {
  const existing = viewer.terrainProvider as TerrainProvider | undefined;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stopListening();
      reject(new Error('the terrain did not load'));
    }, TERRAIN_WAIT_MS);
    const stopListening = viewer.scene.globe.terrainProviderChanged.addEventListener(
      (provider?: TerrainProvider) => {
        if (!provider) return;
        clearTimeout(timer);
        stopListening();
        resolve(provider);
      },
    );
  });
}
