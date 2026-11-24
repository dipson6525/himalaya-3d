/**
 * sampleHeights.ts — terrain heights along a trek for the elevation profile, cached per route.
 * Owner: Dipson Gurung. Related FR: FR4, issue #21.
 *
 * - The trail is resampled every PROFILE_SPACING_M (50 m) metres (lib/geo/resample.ts).
 * - Cesium's sampleTerrainMostDetailed asks the terrain for the height at each sample, at the
 *   finest detail it has there. These are heights above the WGS84 ELLIPSOID from Cesium World
 *   Terrain, not the cited stop altitudes (which are above sea level and come from other sources).
 * - Without a Cesium token there is no terrain (a smooth ellipsoid): there are no heights to show,
 *   and the result says `noTerrain`, so the UI says so instead of showing fake 0 m numbers.
 * - No height may silently become 0 m (it would look like a cliff and wreck the totals):
 *   a failed terrain tile rejects (rejectOnTileFail), and every height starts as NaN, so a height
 *   Cesium could not fill in is caught below. Then the whole sampling fails ("could not load").
 *   Failures are not cached, so trying again samples again.
 * - The result is cached per route id: sampling takes a while, and going back to a trek should
 *   not sample it again. The route id is a safe key: route files do not change while the page is
 *   open, and the terrain does not change either (with a token, Cesium has no terrain provider at
 *   all until World Terrain is ready; without one it stays the ellipsoid).
 */
import { Cartographic, sampleTerrainMostDetailed, type TerrainProvider } from 'cesium';
import type { LonLat } from '../../lib/geo/distance';
import { resampleTrail } from '../../lib/geo/resample';
import { buildProfile, PROFILE_SPACING_M, type ElevationProfile } from './profile';

/** A sampled profile, or the news that there is no terrain to sample. */
export type ProfileResult = { noTerrain: false; profile: ElevationProfile } | { noTerrain: true };

/** Heights at each [lon, lat] point, or null if the terrain has no detail data (no token). */
export async function sampleHeights(
  provider: TerrainProvider,
  points: readonly LonLat[],
): Promise<number[] | null> {
  // The smooth ellipsoid (no token) has no "availability", and sampleTerrainMostDetailed refuses
  // such a terrain. There is nothing to sample.
  if (!provider.availability) return null;
  // Start every height as NaN (not 0), so one that Cesium leaves unfilled cannot pass as 0 m.
  const places = points.map(([lon, lat]) => Cartographic.fromDegrees(lon, lat, Number.NaN));
  await sampleTerrainMostDetailed(provider, places, true); // true: a failed tile rejects
  const heightsM = places.map((place) => place.height);
  if (heightsM.some((h) => !Number.isFinite(h))) {
    throw new Error('some terrain heights could not be read');
  }
  return heightsM;
}

/** Sample one trek: resample its trail, ask the terrain, build the profile. */
async function sampleProfile(
  trail: readonly LonLat[],
  provider: TerrainProvider,
): Promise<ProfileResult> {
  const samples = resampleTrail(trail, PROFILE_SPACING_M);
  const heightsM = await sampleHeights(provider, samples.points);
  if (!heightsM) return { noTerrain: true };
  return { noTerrain: false, profile: buildProfile(samples.distancesM, heightsM) };
}

/** One sampling (a Promise) per route id; kept while the page is open. */
const cache = new Map<string, Promise<ProfileResult>>();

/** The profile of route `routeId`: from the cache if it was sampled before, else sampled now. */
export function loadProfile(
  routeId: string,
  trail: readonly LonLat[],
  provider: TerrainProvider,
): Promise<ProfileResult> {
  let result = cache.get(routeId);
  if (!result) {
    const attempt = sampleProfile(trail, provider);
    cache.set(routeId, attempt);
    // Do not keep a failure: the next request for this route samples again. (Only remove THIS
    // attempt; a newer one may already be in the cache.)
    attempt.catch(() => {
      if (cache.get(routeId) === attempt) cache.delete(routeId);
    });
    result = attempt;
  }
  return result;
}

/** Empty the cache (for tests). */
export function clearProfileCache(): void {
  cache.clear();
}
