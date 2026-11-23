/**
 * sampleHeights.test.ts — profile sampling: no-terrain fallback, failures, the per-route cache.
 * Owner: Dipson Gurung. Related FR: FR4, issue #21.
 *
 * Cesium's sampleTerrainMostDetailed is replaced (vi.mock), so no network and no real terrain
 * are needed. The trail is synthetic: 0.02° along the equator (2,223.9 m) → 45 intervals of
 * at most 50 m → 46 samples.
 */
import { sampleTerrainMostDetailed, type TerrainProvider } from 'cesium';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LonLat } from '../../lib/geo/distance';
import { clearProfileCache, loadProfile, sampleHeights } from './sampleHeights';

vi.mock('cesium', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cesium')>();
  return { ...actual, sampleTerrainMostDetailed: vi.fn() };
});

const TRAIL: LonLat[] = [
  [0, 0],
  [0.02, 0],
];
const WITH_TERRAIN = { availability: {} } as unknown as TerrainProvider;
const NO_TERRAIN = {} as unknown as TerrainProvider; // like the smooth ellipsoid: no availability

/** sampleTerrainMostDetailed "returns" height(i) for sample i. */
function terrainReturns(height: (index: number) => number) {
  vi.mocked(sampleTerrainMostDetailed).mockImplementation(async (_provider, places) => {
    places.forEach((place, i) => (place.height = height(i)));
    return places;
  });
}

beforeEach(() => {
  clearProfileCache();
  vi.mocked(sampleTerrainMostDetailed).mockReset();
});

describe('sampleHeights', () => {
  it('without terrain (no token) every height is 0 and it says so; nothing is requested', async () => {
    const result = await sampleHeights(NO_TERRAIN, TRAIL);
    expect(result).toEqual({ heightsM: [0, 0], noTerrain: true });
    expect(sampleTerrainMostDetailed).not.toHaveBeenCalled();
  });

  it('asks for the most detailed heights and rejects on a failed tile', async () => {
    terrainReturns(() => 2000);
    await sampleHeights(WITH_TERRAIN, TRAIL);
    expect(vi.mocked(sampleTerrainMostDetailed).mock.calls[0][2]).toBe(true); // rejectOnTileFail
  });
});

describe('loadProfile', () => {
  it('samples every ≤ 50 m and builds the profile', async () => {
    terrainReturns((i) => 1000 + 10 * i); // a steady climb: 45 steps × 10 m = 450 m
    const { profile, noTerrain } = await loadProfile('r1', TRAIL, WITH_TERRAIN);
    expect(noTerrain).toBe(false);
    expect(profile.points).toHaveLength(46);
    expect(profile.lengthM).toBeCloseTo(2223.9, 1);
    expect(profile.ascentM).toBe(450);
    expect(profile.highest.heightM).toBe(1450);
  });

  it('samples a route only once (cached), but each route separately', async () => {
    terrainReturns(() => 1000);
    await loadProfile('r1', TRAIL, WITH_TERRAIN);
    await loadProfile('r1', TRAIL, WITH_TERRAIN);
    expect(sampleTerrainMostDetailed).toHaveBeenCalledTimes(1);
    await loadProfile('r2', TRAIL, WITH_TERRAIN);
    expect(sampleTerrainMostDetailed).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failure: the next request samples again', async () => {
    vi.mocked(sampleTerrainMostDetailed).mockRejectedValueOnce(new Error('tile failed'));
    await expect(loadProfile('r1', TRAIL, WITH_TERRAIN)).rejects.toThrow('tile failed');
    terrainReturns(() => 1000);
    await expect(loadProfile('r1', TRAIL, WITH_TERRAIN)).resolves.toBeDefined();
    expect(sampleTerrainMostDetailed).toHaveBeenCalledTimes(2);
  });
});
