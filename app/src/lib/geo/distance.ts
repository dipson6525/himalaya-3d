/**
 * distance.ts — distances on the Earth and "where am I after s metres?" along a route.
 * Owner: Sparsh Gorkhali. Related FR: FR3 (constant-speed flythrough), FR4 (elevation profile).
 *
 * Pure maths: no React, no Cesium, so every function is tested with Vitest in Node.
 * Positions are [longitude, latitude] in degrees — the same order as GeoJSON.
 */

/** A position as [longitude, latitude] in degrees (GeoJSON order). */
export type LonLat = readonly [lon: number, lat: number];

/** Mean radius of the Earth in metres. Treating the Earth as a sphere of this radius is accurate
 * to about 0.5% for distances, which is plenty for a flythrough and a profile. */
export const EARTH_RADIUS_M = 6_371_000;

/** Degrees → radians: multiply by π / 180. */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two positions, in metres (the haversine formula).
 *
 *   a = sin²(Δφ / 2) + cos φ1 · cos φ2 · sin²(Δλ / 2)
 *   d = 2R · asin(√a)
 *
 * φ = latitude, λ = longitude (both in radians), R = Earth's radius. This is the proposal's
 * equation (3.2). Why not Pythagoras on degrees? One degree of longitude gets shorter away from
 * the equator (it is 111.19 km × cos φ), so "degrees" are not the same length in every direction.
 *
 * Worked example: two points one degree apart on the equator.
 *   Δφ = 0, Δλ = 1° = 0.017453 rad, cos φ1 = cos φ2 = 1
 *   a = sin²(0.0087266) = 0.0000761524
 *   d = 2 × 6,371,000 × asin(0.0087266) = 111,194.9 m   (= 2πR / 360, as expected)
 */
export function haversineM(a: LonLat, b: LonLat): number {
  const phi1 = toRadians(a[1]);
  const phi2 = toRadians(b[1]);
  const deltaPhi = toRadians(b[1] - a[1]);
  const deltaLambda = toRadians(b[0] - a[0]);
  const h =
    Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  // Math.min guards against h being a hair above 1 from rounding, which would make asin NaN.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, h)));
}

/**
 * Distance from the start of the route to every point, in metres: [0, d01, d01 + d12, ...].
 *
 * This is the "table of cumulative distances" from the proposal (section 3.4). With it we can
 * turn "the camera has travelled s metres" into a place on the route, which is what makes the
 * flythrough move at a constant ground speed even when the points are unevenly spaced.
 */
export function cumulativeDistancesM(points: readonly LonLat[]): number[] {
  const distances: number[] = [];
  let total = 0;
  points.forEach((point, index) => {
    if (index > 0) total += haversineM(points[index - 1], point);
    distances.push(total);
  });
  return distances;
}

/** Where a distance falls: on segment `segment` (from point i to i+1), a fraction `t` of the way. */
export interface RoutePosition {
  segment: number;
  /** 0 = at point `segment`, 1 = at point `segment + 1`. */
  t: number;
}

/**
 * Find which segment of the route contains the distance `s` (metres from the start).
 *
 * Binary search over the cumulative table: each step halves the range, so a route with 10,000
 * points needs about 14 steps (log₂ 10,000 ≈ 13.3) instead of up to 10,000.
 * Then t = (s − cumulative[i]) / (cumulative[i+1] − cumulative[i]).
 * Distances before the start or past the end are clamped to the ends.
 */
export function locateDistance(cumulative: readonly number[], s: number): RoutePosition {
  const last = cumulative.length - 1;
  if (last < 1) throw new RangeError('a route needs at least 2 points');
  if (s <= 0) return { segment: 0, t: 0 };
  if (s >= cumulative[last]) return { segment: last - 1, t: 1 };

  // Invariant: cumulative[low] <= s < cumulative[high].
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (cumulative[middle] <= s) low = middle;
    else high = middle;
  }
  const length = cumulative[high] - cumulative[low];
  // A zero-length segment (two identical points) cannot contain s strictly inside it, but guard
  // the division anyway.
  const t = length > 0 ? (s - cumulative[low]) / length : 0;
  return { segment: low, t };
}

/**
 * The [lon, lat] a fraction t of the way along a segment, by straight-line interpolation of the
 * coordinates: p = p_i + t (p_{i+1} − p_i). Good for the short segments of a trail (metres to a few
 * hundred metres); it is not a great-circle path, which only matters over hundreds of kilometres.
 */
export function pointOnSegment(points: readonly LonLat[], position: RoutePosition): LonLat {
  const start = points[position.segment];
  const end = points[position.segment + 1];
  return [start[0] + position.t * (end[0] - start[0]), start[1] + position.t * (end[1] - start[1])];
}
