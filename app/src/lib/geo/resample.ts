/**
 * resample.ts — points at equal intervals along a trail.
 * Owner: Sparsh Gorkhali (moved here from the flythrough in #21 so the elevation profile can use
 * it too). Related FR: FR3 (flythrough, every 100 m), FR4 (elevation profile, every 50 m).
 *
 * A trail's own points are unevenly spaced: a few metres apart on switchbacks, hundreds of metres
 * on straight bits. The flythrough and the profile both want evenly spaced samples instead.
 */
import { cumulativeDistancesM, locateDistance, pointOnSegment, type LonLat } from './distance';

/** Samples along the trail: their [lon, lat] and their distance from the start in metres. */
export interface TrailSamples {
  points: LonLat[];
  distancesM: number[];
}

/**
 * Points at equal intervals of at most `spacingM` metres along the trail, from the start to the
 * exact end. Equal intervals (e.g. 2,223.9 m at most 100 m apart → 23 intervals of 96.7 m, not 22
 * of 100 m and one of 23.9 m) keep the flythrough's spline even; a very short last piece would
 * make it bulge. Uses the cumulative-distance table and binary search from distance.ts (#18).
 */
export function resampleTrail(trail: readonly LonLat[], spacingM: number): TrailSamples {
  if (!(spacingM > 0)) throw new RangeError(`spacing must be positive, got ${spacingM}`);
  if (trail.length < 2) throw new RangeError('a trail needs at least 2 points');
  const cumulative = cumulativeDistancesM(trail);
  const total = cumulative[cumulative.length - 1];
  // Samples need increasing distances; a trail whose points are all the same place has none.
  if (!(total > 0)) throw new RangeError('the trail has no length');
  const intervals = Math.ceil(total / spacingM);
  const distancesM: number[] = [];
  for (let i = 0; i < intervals; i++) distancesM.push((i * total) / intervals);
  distancesM.push(total); // always end exactly at the end of the trail
  const points = distancesM.map((s) => pointOnSegment(trail, locateDistance(cumulative, s)));
  return { points, distancesM };
}
