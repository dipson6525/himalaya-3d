/**
 * path.ts — the maths of the flythrough: where the camera is after travelling s metres.
 * Owner: Sparsh Gorkhali. Related FR: FR3 (animated flythrough), issue #19.
 *
 * Steps, each a small function with its own tests (path.test.ts):
 * 1. resampleTrail: points at equal intervals of at most SAMPLE_SPACING_M metres along the trail
 *    (the trail's own points are unevenly spaced: a few metres apart on switchbacks, hundreds of
 *    metres on straight bits).
 * 2. safeHeights: the height of the flight line at each sample = the HIGHEST terrain within a few
 *    samples either side + a clearance, so the curve between samples cannot dip into a ridge.
 * 3. buildFlightPath: a Catmull-Rom spline through those points in ECEF (Cesium's x, y, z in
 *    metres from the Earth's centre), plus a DISTANCE LOOKUP TABLE for the curve itself
 *    (proposal section 3.4): the spline is sampled every TABLE_STEP_M and the ground distance
 *    between the samples is added up. pointAt(s) looks s up in that table (binary search,
 *    locateDistance from #18) to find where on the spline the camera is. Moving s forward by
 *    speed × seconds each frame then gives a constant ground speed, even around corners, where
 *    the curve cuts inside the trail and is shorter than it.
 * 4. cameraPose: the camera sits BEHIND_M behind and UP_M above the current point and looks at the
 *    point AHEAD_M ahead. Heading and pitch come from that direction.
 * 5. smoothAngle / smoothValue: heading and pitch are smoothed (exponential smoothing), so a
 *    zig-zag in the trail does not swing the camera from side to side or up and down.
 *
 * Only Cesium's maths classes are used (no Viewer), so all of this runs in Vitest under Node.
 */
import { Cartesian3, Cartographic, CatmullRomSpline, Matrix4, Transforms } from 'cesium';
import {
  cumulativeDistancesM,
  locateDistance,
  pointOnSegment,
  type LonLat,
} from '../../lib/geo/distance';

/** Largest distance between two samples of the flight line, in metres. */
export const SAMPLE_SPACING_M = 100;
/** Step of the curve's distance lookup table, in units of the spline's "time" (metres). */
export const TABLE_STEP_M = 10;
/** Height of the flight line above the highest nearby terrain, in metres. */
export const CLEARANCE_M = 250;
/** How many samples either side are looked at for the highest terrain (5 × 100 m = 500 m). */
export const HEIGHT_WINDOW_SAMPLES = 5;
/** The camera is this far behind the current point (along the trail) … */
export const BEHIND_M = 600;
/** … this far above the flight line … */
export const UP_M = 300;
/** … and looks at the point this far ahead. */
export const AHEAD_M = 800;

/** Samples along the trail: their [lon, lat] and their distance from the start in metres. */
export interface TrailSamples {
  points: LonLat[];
  distancesM: number[];
}

/**
 * Points at equal intervals of at most `spacingM` metres along the trail, from the start to the
 * exact end. Equal intervals (e.g. 2,223.9 m → 23 intervals of 96.7 m, not 22 of 100 m and one of
 * 23.9 m) keep the spline's shape even; a very short last piece would make it bulge.
 * Uses the cumulative-distance table and binary search from lib/geo/distance.ts (#18).
 */
export function resampleTrail(
  trail: readonly LonLat[],
  spacingM: number = SAMPLE_SPACING_M,
): TrailSamples {
  if (!(spacingM > 0)) throw new RangeError(`spacing must be positive, got ${spacingM}`);
  if (trail.length < 2) throw new RangeError('a trail needs at least 2 points');
  const cumulative = cumulativeDistancesM(trail);
  const total = cumulative[cumulative.length - 1];
  // A spline needs increasing "times"; a trail whose points are all the same place has none.
  if (!(total > 0)) throw new RangeError('the trail has no length');
  const intervals = Math.ceil(total / spacingM);
  const distancesM: number[] = [];
  for (let i = 0; i < intervals; i++) distancesM.push((i * total) / intervals);
  distancesM.push(total); // always end exactly at the end of the trail
  const points = distancesM.map((s) => pointOnSegment(trail, locateDistance(cumulative, s)));
  return { points, distancesM };
}

/**
 * Flight-line heights: for sample i, the highest ground height between samples i − window and
 * i + window, plus the clearance. Looking at neighbours too matters because the camera moves
 * along a CURVE between samples and the terrain between them is unknown: a ridge just after a
 * sample is then still below the line.
 */
export function safeHeights(
  groundM: readonly number[],
  window: number = HEIGHT_WINDOW_SAMPLES,
  clearanceM: number = CLEARANCE_M,
): number[] {
  return groundM.map((_, i) => {
    let highest = Number.NEGATIVE_INFINITY;
    for (let j = Math.max(0, i - window); j <= Math.min(groundM.length - 1, i + window); j++) {
      highest = Math.max(highest, groundM[j]);
    }
    return highest + clearanceM;
  });
}

/** The flight line: a spline, and a table to turn "metres along the curve" into spline time. */
export interface FlightPath {
  spline: CatmullRomSpline;
  /** Spline "times" at which the curve was sampled for the table (every TABLE_STEP_M). */
  tableTimes: number[];
  /** Ground distance along the CURVE from its start to each of those samples, in metres. */
  tableDistancesM: number[];
  /** Ground length of the curve in metres (the largest valid distance for pointAt). */
  lengthM: number;
}

/**
 * Catmull-Rom spline through the samples at their flight heights, in ECEF. A Catmull-Rom spline
 * passes THROUGH every control point (some other splines only pass near them), so the camera
 * really goes over each sample. `times` are the samples' ground distances, which must increase.
 */
export function buildFlightPath(samples: TrailSamples, heightsM: readonly number[]): FlightPath {
  if (samples.points.length < 2) throw new RangeError('a flight path needs at least 2 samples');
  if (heightsM.length !== samples.points.length) {
    throw new RangeError('one height is needed per sample');
  }
  const points = samples.points.map(([lon, lat], i) =>
    Cartesian3.fromDegrees(lon, lat, heightsM[i]),
  );
  const spline = new CatmullRomSpline({ times: samples.distancesM, points });

  // The distance lookup table: walk along the spline in small steps of its "time" and add up the
  // ground (haversine) distance between consecutive points.
  const lastTime = samples.distancesM[samples.distancesM.length - 1];
  const tableTimes: number[] = [];
  for (let time = 0; time < lastTime; time += TABLE_STEP_M) tableTimes.push(time);
  tableTimes.push(lastTime);
  const groundPoints = tableTimes.map((time) => toLonLat(spline.evaluate(time, new Cartesian3())));
  const tableDistancesM = cumulativeDistancesM(groundPoints);

  return {
    spline,
    tableTimes,
    tableDistancesM,
    lengthM: tableDistancesM[tableDistancesM.length - 1],
  };
}

/**
 * The point of the flight line `s` metres (ground distance along the curve) from its start.
 * s is kept inside 0…length. The table says between which two samples s falls and how far
 * (segment, t); the spline time in between is interpolated the same way.
 */
export function pointAt(path: FlightPath, s: number): Cartesian3 {
  const { segment, t } = locateDistance(path.tableDistancesM, s); // clamps to the ends
  const time =
    path.tableTimes[segment] + t * (path.tableTimes[segment + 1] - path.tableTimes[segment]);
  return path.spline.evaluate(time, new Cartesian3());
}

/**
 * The curve distance (the `s` of pointAt) of the place `trailDistanceM` metres along the TRAIL.
 * The spline's "time" is the trail distance, so this is the distance table read the other way
 * round: find the time in tableTimes, read the curve distance next to it. Used to jump to the
 * start of a day, whose position the stage maths gives as a trail distance (#20).
 */
export function curveDistanceForTrail(path: FlightPath, trailDistanceM: number): number {
  const { segment, t } = locateDistance(path.tableTimes, trailDistanceM); // clamps to the ends
  const from = path.tableDistancesM[segment];
  return from + t * (path.tableDistancesM[segment + 1] - from);
}

/** [lon, lat] in degrees of a Cesium position (its height is dropped). */
function toLonLat(position: Cartesian3): LonLat {
  const c = Cartographic.fromCartesian(position);
  return [(c.longitude * 180) / Math.PI, (c.latitude * 180) / Math.PI];
}

/**
 * Heading and pitch (radians) of the direction from `from` to `to`, as Cesium's camera wants
 * them: heading 0 = north, π/2 = east; pitch 0 = level, negative = looking down.
 * The direction is turned into local east/north/up components at `from` (Cesium's
 * eastNorthUpToFixedFrame gives the matrix; its inverse goes from ECEF to local), then
 * heading = atan2(east, north) and pitch = atan2(up, horizontal distance).
 */
export function headingPitchTo(
  from: Cartesian3,
  to: Cartesian3,
): { heading: number; pitch: number } {
  const toLocal = Matrix4.inverseTransformation(
    Transforms.eastNorthUpToFixedFrame(from),
    new Matrix4(),
  );
  const local = Matrix4.multiplyByPoint(toLocal, to, new Cartesian3()); // x east, y north, z up
  const heading = Math.atan2(local.x, local.y);
  const pitch = Math.atan2(local.z, Math.hypot(local.x, local.y));
  return { heading: wrapTo2Pi(heading), pitch };
}

/** An angle moved into 0 … 2π. */
export function wrapTo2Pi(angle: number): number {
  const full = 2 * Math.PI;
  return ((angle % full) + full) % full;
}

/** An angle difference moved into −π … π, i.e. the shorter way round the circle. */
export function wrapToPi(angle: number): number {
  return wrapTo2Pi(angle + Math.PI) - Math.PI;
}

/**
 * Exponential smoothing of an angle: move a fraction α of the way from `current` to `target`,
 * where α = 1 − e^(−dt / τ). After τ seconds the camera has turned about 63% of the way; the
 * formula gives the same result whether the frame rate is high or low.
 * The difference is taken the SHORT way round: from 350° to 10° is +20°, not −340°.
 */
export function smoothAngle(current: number, target: number, dtS: number, tauS: number): number {
  const alpha = 1 - Math.exp(-dtS / tauS);
  return wrapTo2Pi(current + alpha * wrapToPi(target - current));
}

/** The same exponential smoothing for a value that does not wrap round (used for the pitch). */
export function smoothValue(current: number, target: number, dtS: number, tauS: number): number {
  const alpha = 1 - Math.exp(-dtS / tauS);
  return current + alpha * (target - current);
}

/** Where the camera is and where it looks. */
export interface CameraPose {
  position: Cartesian3;
  /** The look-ahead point the camera looks at. */
  target: Cartesian3;
  /** Direction to the look-ahead point (before smoothing). */
  heading: number;
  pitch: number;
}

/**
 * The camera for distance `s` (the "current point"): BEHIND_M back along the flight line and
 * UP_M higher, looking at the point AHEAD_M ahead. Near the start and end the two points are
 * clamped to the path. (The controller therefore starts at s = BEHIND_M, where the camera is at
 * the very start of the trail, so the camera moves from the first frame.)
 */
export function cameraPose(path: FlightPath, s: number): CameraPose {
  const behind = pointAt(path, s - BEHIND_M);
  const position = raise(behind, UP_M);
  const target = pointAt(path, s + AHEAD_M);
  return { position, target, ...headingPitchTo(position, target) };
}

/** The same place, `metres` higher. */
export function raise(position: Cartesian3, metres: number): Cartesian3 {
  const c = Cartographic.fromCartesian(position);
  return Cartesian3.fromRadians(c.longitude, c.latitude, c.height + metres);
}
