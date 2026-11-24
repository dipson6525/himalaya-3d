/**
 * profile.ts — the numbers behind the elevation profile: total ascent and descent, the highest
 * terrain point, and where the overnight stops fall along the trail.
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
 * A change in the other direction smaller than this (in metres) is not counted. Terrain heights
 * wobble a little from sample to sample; summing every wobble would make the totals too big.
 * A design choice, not a measured value: TODO(team): compare the totals with published figures
 * for each real trek and adjust if needed.
 */
export const CLIMB_THRESHOLD_M = 5;

/** One point of the profile: how far along the trail line, and how high the terrain is. */
export interface ProfilePoint {
  distanceM: number;
  heightM: number;
}

/** The terrain profile of one trek's trail line (once, in the direction the line is stored). */
export interface ElevationProfile {
  points: ProfilePoint[];
  highest: ProfilePoint;
  lengthM: number;
}

/**
 * Total ascent and descent of a list of heights, with a "dead band".
 *
 * Rule: keep the last counted height and the current direction (climbing or descending).
 * - A step further in the SAME direction always counts, however small.
 * - A step in the OTHER direction counts only once the height is at least `thresholdM` away from
 *   the last counted height; then the direction turns round.
 * So wobbles smaller than the threshold are ignored, and every real climb counts in full.
 *
 * Worked example, threshold 5 m, heights 100, 103, 101, 110, 108, 120, 95:
 *   start at 100, no direction yet → 103 (+3, under 5: ignored) → 101 (+1) → 110 (+10: ascent 10,
 *   now climbing, last 110) → 108 (−2, other way, under 5: ignored) → 120 (+10, same way: ascent
 *   20) → 95 (−25, other way, over 5: descent 25, now descending).
 *   Result: 20 m up, 25 m down. Summing every step would give 24 m and 29 m.
 * Up to 1,104 m and back to 1,000 m in 1 m steps gives 104 up and 104 down.
 * Ascent − descent = last counted height − first height.
 */
export function climbTotals(
  heightsM: readonly number[],
  thresholdM: number = CLIMB_THRESHOLD_M,
): { ascentM: number; descentM: number } {
  if (!(thresholdM >= 0)) throw new RangeError(`threshold must be 0 or more, got ${thresholdM}`);
  if (heightsM.some((h) => !Number.isFinite(h))) {
    throw new RangeError('every height must be a finite number');
  }
  let ascentM = 0;
  let descentM = 0;
  let last = heightsM[0]; // the last counted height
  let direction = 0; // +1 climbing, −1 descending, 0 not known yet
  for (const height of heightsM) {
    const change = height - last;
    if (change === 0) continue;
    const sameWay = Math.sign(change) === direction;
    if (sameWay || Math.abs(change) >= thresholdM) {
      if (change > 0) ascentM += change;
      else descentM -= change;
      direction = Math.sign(change);
      last = height;
    }
  }
  return { ascentM, descentM };
}

/** The highest point (the first one, if several are equally high). */
export function highestPoint(points: readonly ProfilePoint[]): ProfilePoint {
  if (points.length === 0) throw new RangeError('a profile needs at least one point');
  let best = points[0];
  for (const point of points) {
    if (point.heightM > best.heightM) best = point;
  }
  return best;
}

/** The profile from sample distances and the terrain heights sampled there. */
export function buildProfile(
  distancesM: readonly number[],
  heightsM: readonly number[],
): ElevationProfile {
  if (distancesM.length !== heightsM.length) {
    throw new RangeError('one height is needed per distance');
  }
  const points = distancesM.map((distanceM, i) => ({ distanceM, heightM: heightsM[i] }));
  return { points, highest: highestPoint(points), lengthM: distancesM[distancesM.length - 1] ?? 0 };
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

/**
 * The heights walked from distance `fromM` to distance `toM` along the line: the height at the
 * start, every sample in between, the height at the end. Backwards (fromM > toM) for the way back
 * of an out-and-back trek.
 */
export function heightsBetween(profile: ElevationProfile, fromM: number, toM: number): number[] {
  if (fromM > toM) return heightsBetween(profile, toM, fromM).reverse();
  const inBetween = profile.points
    .filter((p) => p.distanceM > fromM && p.distanceM < toM)
    .map((p) => p.heightM);
  return [heightAt(profile, fromM), ...inBetween, heightAt(profile, toM)];
}

/**
 * Total ascent and descent of the trek as WALKED: stop to stop in day order, each stage in its
 * own direction. For a trek that walks the line out and back (ADR-027), the way back counts too;
 * the line on its own would only give the way out. With fewer than two stops, the whole line once.
 */
export function walkedTotals(
  profile: ElevationProfile,
  stops: readonly { day: number; distanceM: number }[],
  thresholdM: number = CLIMB_THRESHOLD_M,
): { ascentM: number; descentM: number } {
  const inDayOrder = [...stops].sort((a, b) => a.day - b.day);
  if (inDayOrder.length < 2) {
    return climbTotals(
      profile.points.map((p) => p.heightM),
      thresholdM,
    );
  }
  const walked: number[] = [];
  for (let k = 1; k < inDayOrder.length; k++) {
    const stage = heightsBetween(profile, inDayOrder[k - 1].distanceM, inDayOrder[k].distanceM);
    // Each stage starts where the previous one ended: do not count that stop's height twice.
    walked.push(...(k === 1 ? stage : stage.slice(1)));
  }
  return climbTotals(walked, thresholdM);
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
 * sources and can differ. (On an out-and-back trek a stop on the way back sits at the same
 * distance as the way out, so its marker is drawn over the other one.)
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
