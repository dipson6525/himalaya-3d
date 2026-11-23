/**
 * profile.ts — the numbers behind the elevation profile: total ascent and descent, the highest
 * point, and where the overnight stops fall along the trail.
 * Owner: Dipson Gurung. Related FR: FR4 (elevation profile), issue #21.
 *
 * Pure maths: no React, no Cesium, so it is tested with Vitest in Node. The heights themselves are
 * sampled from Cesium's terrain by sampleHeights.ts.
 */
import { locateDistance, type LonLat } from '../../lib/geo/distance';
import { nearestPointOnLine } from '../../lib/geo/stages';

/** Distance between two profile samples along the trail, in metres (FR4: "about every 50 m"). */
export const PROFILE_SPACING_M = 50;

/**
 * Climbs and drops smaller than this (in metres) are not counted in the totals. Terrain heights
 * wobble a little from sample to sample; summing every wobble would make the totals too big.
 * A design choice, not a measured value: TODO(team): compare the totals with published figures
 * for each real trek and adjust if needed.
 */
export const CLIMB_THRESHOLD_M = 5;

/** One point of the profile: how far along the trail, and how high. */
export interface ProfilePoint {
  distanceM: number;
  heightM: number;
}

/** The profile of one trek. */
export interface ElevationProfile {
  points: ProfilePoint[];
  ascentM: number;
  descentM: number;
  highest: ProfilePoint;
  lengthM: number;
}

/**
 * Total ascent and descent, with a "dead band": remember the height of the last turning point;
 * count a change only once the height is at least `thresholdM` away from it, then move the
 * turning point there.
 *
 * Worked example, threshold 5 m, heights 100, 103, 101, 110, 108, 120, 95:
 *   turning point 100 → 103 (+3, ignored) → 101 (+1) → 110 (+10: ascent 10, turn at 110)
 *   → 108 (−2, ignored) → 120 (+10: ascent 20, turn at 120) → 95 (−25: descent 25, turn at 95).
 *   Result: ascent 20 m, descent 25 m. Summing every step would give 24 m and 29 m.
 * A steady climb in small steps still counts in full (it is measured from the turning point,
 * not step by step). Ascent − descent = last turning point − first height.
 */
export function climbTotals(
  heightsM: readonly number[],
  thresholdM: number = CLIMB_THRESHOLD_M,
): { ascentM: number; descentM: number } {
  if (heightsM.some((h) => !Number.isFinite(h))) {
    throw new RangeError('every height must be a finite number');
  }
  let ascentM = 0;
  let descentM = 0;
  let turningPoint = heightsM[0];
  for (const height of heightsM) {
    const change = height - turningPoint;
    if (change >= thresholdM && change > 0) {
      ascentM += change;
      turningPoint = height;
    } else if (-change >= thresholdM && change < 0) {
      descentM -= change;
      turningPoint = height;
    }
  }
  return { ascentM, descentM };
}

/** The highest point (the first one, if several are equally high). */
export function highestPoint(points: readonly ProfilePoint[]): ProfilePoint {
  if (points.length === 0) throw new RangeError('a profile needs at least one point');
  return points.reduce((best, point) => (point.heightM > best.heightM ? point : best));
}

/** The profile from sample distances and the terrain heights sampled there. */
export function buildProfile(
  distancesM: readonly number[],
  heightsM: readonly number[],
  thresholdM: number = CLIMB_THRESHOLD_M,
): ElevationProfile {
  if (distancesM.length !== heightsM.length) {
    throw new RangeError('one height is needed per distance');
  }
  const points = distancesM.map((distanceM, i) => ({ distanceM, heightM: heightsM[i] }));
  return {
    points,
    ...climbTotals(heightsM, thresholdM),
    highest: highestPoint(points),
    lengthM: distancesM[distancesM.length - 1] ?? 0,
  };
}

/**
 * The profile's height at any distance along the trail, by straight-line interpolation between
 * the two samples around it (binary search, locateDistance from #18).
 */
export function heightAt(profile: ElevationProfile, distanceM: number): number {
  const distances = profile.points.map((p) => p.distanceM);
  const { segment, t } = locateDistance(distances, distanceM);
  const a = profile.points[segment].heightM;
  const b = profile.points[segment + 1].heightM;
  return a + t * (b - a);
}

/** A stop as the profile needs it. */
export interface ProfileStopInput {
  id: string;
  label: string;
  day: number;
  /** The stop's cited altitude from the route file (shown in the tooltip, not plotted). */
  altitudeM: number;
  position: LonLat;
}

/** A stop placed on the profile: where along the trail, and the terrain height there. */
export interface ProfileStop extends ProfileStopInput {
  distanceM: number;
  /** Terrain height of the profile at that distance (where the marker is drawn). */
  profileHeightM: number;
}

/**
 * Put each stop on the profile: its distance along the trail (the nearest point of the trail,
 * as for the daily stages) and the profile's terrain height there. The marker is drawn ON the
 * terrain line; the cited altitude goes in the tooltip, because the two come from different
 * sources and can differ.
 */
export function stopsOnProfile(
  trail: readonly LonLat[],
  stops: readonly ProfileStopInput[],
  profile: ElevationProfile,
): ProfileStop[] {
  return stops.map((stop) => {
    const { distanceM } = nearestPointOnLine(trail, stop.position);
    return { ...stop, distanceM, profileHeightM: heightAt(profile, distanceM) };
  });
}
