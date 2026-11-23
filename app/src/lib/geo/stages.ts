/**
 * stages.ts — split a trek's trail into daily stages: the part walked between two stops.
 * Owner: Sparsh Gorkhali. Related FR: FR2 (route, stops and daily stages), issue #49.
 *
 * A route file stores ONE trail line and the overnight stops with the day they are reached
 * (ADR-017). To find what is walked on each day:
 * 1. put every stop on the trail: find the nearest point of the line and measure how far along
 *    the line it is (nearestPointOnLine);
 * 2. take the stops in day order: the stage that ENDS at a stop runs from the previous stop's
 *    distance to this stop's distance, and is walked on this stop's arrival day;
 * 3. cut that piece out of the line (sliceLine).
 *
 * Pure maths: no React, no Cesium, so it is tested with Vitest in Node.
 * Distances are map (horizontal) distances along the simplified trail; a steep trail is longer
 * to walk, and the simplified line skips small zig-zags, so real walking distances are longer.
 */
import {
  cumulativeDistancesM,
  EARTH_RADIUS_M,
  locateDistance,
  pointOnSegment,
  type LonLat,
} from './distance';

/** Metres per degree of latitude (and of longitude at the equator): 2πR / 360 ≈ 111,195 m. */
const METRES_PER_DEGREE = (EARTH_RADIUS_M * Math.PI) / 180;

/** Where a point lands on a line. */
export interface PointOnLine {
  /** Metres along the line, from its start to the nearest point. */
  distanceM: number;
  /** How far the point is from the line, in metres (0 = exactly on it). */
  offsetM: number;
}

/**
 * The point of `line` nearest to `point`, given as a distance along the line.
 *
 * For each segment A→B we draw a small flat map around A (x east and y north, in metres; x is
 * shrunk by cos(latitude) because degrees of longitude get shorter away from the equator) and
 * project P onto the segment:
 *
 *   t = ((P − A) · (B − A)) / |B − A|²,  then clamp t to 0…1 (stay on the segment)
 *
 * The nearest point is A + t (B − A); its distance from P is the offset. The segment with the
 * smallest offset wins, and the distance along the line is cumulative[i] + t × (segment length).
 * A flat map is accurate enough because trail segments are short (metres to a few hundred metres).
 *
 * Ties: if two segments are exactly as near, the EARLIER one wins (the test is `<`, not `<=`).
 * A stop near a place the trail passes twice (a switchback, or the way back of an out-and-back
 * trek) can therefore land on the wrong pass. The pipeline refuses loops and branches and keeps
 * stops within 500 m of the trail, which makes this rare; check real routes by eye (ADR-027).
 *
 * `cumulative` (from cumulativeDistancesM) can be passed in when it was already computed.
 */
export function nearestPointOnLine(
  line: readonly LonLat[],
  point: LonLat,
  cumulative: readonly number[] = cumulativeDistancesM(line),
): PointOnLine {
  if (line.length < 2) throw new RangeError('a line needs at least 2 points');
  let best: PointOnLine = { distanceM: 0, offsetM: Number.POSITIVE_INFINITY };

  for (let i = 0; i < line.length - 1; i++) {
    const [lonA, latA] = line[i];
    const [lonB, latB] = line[i + 1];
    const xScale = METRES_PER_DEGREE * Math.cos((latA * Math.PI) / 180);
    // B − A and P − A on the flat map around A, in metres.
    const bx = (lonB - lonA) * xScale;
    const by = (latB - latA) * METRES_PER_DEGREE;
    const px = (point[0] - lonA) * xScale;
    const py = (point[1] - latA) * METRES_PER_DEGREE;

    // t = how far along A→B the foot of the perpendicular from P is (0 = at A, 1 = at B).
    const lengthSquared = bx * bx + by * by;
    let t = 0; // two identical points make a zero-length segment: its only point is A
    if (lengthSquared > 0) t = (px * bx + py * by) / lengthSquared;
    if (t < 0) t = 0; // the foot is before A: the nearest point of the SEGMENT is A
    if (t > 1) t = 1; // the foot is past B: the nearest point is B
    const offsetM = Math.hypot(px - t * bx, py - t * by);

    if (offsetM < best.offsetM) {
      best = { distanceM: cumulative[i] + t * (cumulative[i + 1] - cumulative[i]), offsetM };
    }
  }
  return best;
}

/**
 * The piece of `line` between two distances along it (metres from the start), as a new list of
 * points: the exact start point, every original point in between, and the exact end point.
 * If fromM > toM the piece is returned backwards, i.e. still from `fromM` to `toM` (this happens
 * on the way back of an out-and-back trek, which walks the same trail in the other direction).
 */
export function sliceLine(
  line: readonly LonLat[],
  fromM: number,
  toM: number,
  cumulative: readonly number[] = cumulativeDistancesM(line),
): LonLat[] {
  if (fromM > toM) return sliceLine(line, toM, fromM, cumulative).reverse();
  // Keep both distances on the line first. Otherwise a distance past the end would add the last
  // point twice: once as an "in between" point and once as the (clamped) end point.
  const total = cumulative[cumulative.length - 1];
  const from = Math.min(Math.max(fromM, 0), total);
  const to = Math.min(Math.max(toM, 0), total);
  const start = pointOnSegment(line, locateDistance(cumulative, from));
  const end = pointOnSegment(line, locateDistance(cumulative, to));
  const inBetween = line.filter((_, i) => cumulative[i] > from && cumulative[i] < to);
  return [start, ...inBetween, end];
}

/** A stop as the stage maths needs it. */
export interface StageStop {
  id: string;
  /** The day the trekker arrives (the first stop is day 1). */
  day: number;
  position: LonLat;
  /** The stop's cited altitude in metres (from the route file). */
  altitudeM: number;
}

/** The part of the trail walked on one day: from the previous stop to `toStopId`. */
export interface Stage {
  fromStopId: string;
  toStopId: string;
  /** The day this stage is walked = the arrival day of `toStopId`. */
  day: number;
  /** Map distance along the trail between the two stops, in metres (never negative). */
  lengthM: number;
  /** Where the stage starts: metres along the trail to the previous stop (for "jump to day"). */
  fromDistanceM: number;
  /** The trail between the two stops, starting at the previous stop. */
  path: LonLat[];
  /**
   * The higher of the two stops' altitudes, in metres. The trail itself carries no heights, so
   * StageLayer aims the camera at this height; aiming at sea level leaves the camera on the
   * ground, facing a hillside, on a short stage high up.
   */
  topAltitudeM: number;
}

/**
 * One stage per pair of consecutive stops (in day order), so N stops give N − 1 stages.
 * Rest days need no special case: a stop reached on day 2 followed by one reached on day 4 gives
 * one stage "day 4"; day 3 is spent at the day-2 stop and has no stage.
 */
export function splitIntoStages(line: readonly LonLat[], stops: readonly StageStop[]): Stage[] {
  const cumulative = cumulativeDistancesM(line);
  const inDayOrder = [...stops].sort((a, b) => a.day - b.day);
  const along = inDayOrder.map((stop) => nearestPointOnLine(line, stop.position, cumulative));

  const stages: Stage[] = [];
  for (let k = 1; k < inDayOrder.length; k++) {
    const fromM = along[k - 1].distanceM;
    const toM = along[k].distanceM;
    stages.push({
      fromStopId: inDayOrder[k - 1].id,
      toStopId: inDayOrder[k].id,
      day: inDayOrder[k].day,
      lengthM: Math.abs(toM - fromM),
      fromDistanceM: fromM,
      path: sliceLine(line, fromM, toM, cumulative),
      topAltitudeM: Math.max(inDayOrder[k - 1].altitudeM, inDayOrder[k].altitudeM),
    });
  }
  return stages;
}
