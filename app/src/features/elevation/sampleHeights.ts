/**
 * sampleHeights.ts — terrain heights along a trek for the elevation profile, cached per route.
 * Owner: Dipson Gurung. Related FR: FR4, issue #21.
 *
 * - The trail is resampled every PROFILE_SPACING_M (50 m) metres (lib/geo/resample.ts).
 * - Cesium's sampleTerrainMostDetailed asks the terrain for the height at each sample, at the
 *   finest detail it has there. These are heights above the WGS84 ELLIPSOID from Cesium World
 *   Terrain, not the cited stop altitudes (which are above sea level and come from other sources).
 * - Without a Cesium token there is no terrain (a smooth ellipsoid): every height is 0 m and the
 *   result says `noTerrain`, so the UI can say so instead of showing a fake flat profile.
 * - A terrain tile that fails to load makes the whole sampling fail (rejectOnTileFail), instead
 *   of leaving a hole that would look like a 0 m cliff. Failures are not cached, so choosing the
 *   trek again tries again.
 * - The result is cached per route id: sampling takes a while, and going back to a trek should
 *   not sample it again.
 */
import { Cartographic, sampleTerrainMostDetailed, type TerrainProvider } from 'cesium';
import type { LonLat } from '../../lib/geo/distance';
import { resampleTrail } from '../../lib/geo/resample';
import { buildProfile, PROFILE_SPACING_M, type ElevationProfile } from './profile';

/** A sampled profile, and whether there was real terrain to sample. */
export interface ProfileResult {
  profile: ElevationProfile;
  /** True when there was no terrain (no Cesium token): every height is 0 m. */
  noTerrain: boolean;
}

/** Heights at each [lon, lat] point; all 0 (and noTerrain) if the terrain has no detail data. */
export async function sampleHeights(
  provider: TerrainProvider,
  points: readonly LonLat[],
): Promise<{ heightsM: number[]; noTerrain: boolean }> {
  // The smooth ellipsoid (no token) has no "availability", and sampleTerrainMostDetailed refuses
  // such a terrain; every height would be 0 anyway.
  if (!provider.availability) return { heightsM: points.map(() => 0), noTerrain: true };
  const places = points.map(([lon, lat]) => Cartographic.fromDegrees(lon, lat));
  await sampleTerrainMostDetailed(provider, places, true); // true: a failed tile rejects
  return { heightsM: places.map((place) => place.height), noTerrain: false };
}

/** Sample one trek: resample its trail, ask the terrain, build the profile. */
async function sampleProfile(
  trail: readonly LonLat[],
  provider: TerrainProvider,
): Promise<ProfileResult> {
  const samples = resampleTrail(trail, PROFILE_SPACING_M);
  const { heightsM, noTerrain } = await sampleHeights(provider, samples.points);
  return { profile: buildProfile(samples.distancesM, heightsM), noTerrain };
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
    result = sampleProfile(trail, provider);
    cache.set(routeId, result);
    // Do not keep a failure: the next request for this route samples again.
    result.catch(() => cache.delete(routeId));
  }
  return result;
}

/** Empty the cache (for tests). */
export function clearProfileCache(): void {
  cache.clear();
}
