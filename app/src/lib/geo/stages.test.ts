/**
 * stages.test.ts — splitting a trail into daily stages (FR2, issue #49).
 * Owner: Sparsh Gorkhali.
 *
 * The test lines lie on or next to the equator, where the numbers are easy to check by hand:
 * 0.01° of longitude (or latitude) = 6,371,000 × 0.01 × π / 180 = 1,111.95 m, and the flat-map
 * x scale is cos(0°) = 1, so the flat map and the haversine distances agree exactly.
 */
import { describe, expect, it } from 'vitest';
import type { LonLat } from './distance';
import { nearestPointOnLine, sliceLine, splitIntoStages, type StageStop } from './stages';

const STEP_M = 1111.95; // 0.01° on the equator, rounded to cm

/** Straight line along the equator: 0°, 0.01°, 0.02° east. Total 2,223.90 m. */
const STRAIGHT: LonLat[] = [
  [0, 0],
  [0.01, 0],
  [0.02, 0],
];

/** An L: east along the equator for 0.01°, then north for 0.01°. */
const L_SHAPE: LonLat[] = [
  [0, 0],
  [0.01, 0],
  [0.01, 0.01],
];

describe('nearestPointOnLine', () => {
  it('a point beside the middle of a segment lands halfway along it', () => {
    const result = nearestPointOnLine(STRAIGHT, [0.005, 0.001]);
    expect(result.distanceM).toBeCloseTo(STEP_M / 2, 1); // 555.97 m
    expect(result.offsetM).toBeCloseTo(STEP_M / 10, 1); // 0.001° north = 111.19 m
  });

  it('a point on a vertex lands exactly there, with no offset', () => {
    const result = nearestPointOnLine(STRAIGHT, [0.01, 0]);
    expect(result.distanceM).toBeCloseTo(STEP_M, 1);
    expect(result.offsetM).toBeCloseTo(0, 6);
  });

  it('points before the start or past the end are clamped to the ends', () => {
    expect(nearestPointOnLine(STRAIGHT, [-0.01, 0]).distanceM).toBe(0);
    expect(nearestPointOnLine(STRAIGHT, [-0.01, 0]).offsetM).toBeCloseTo(STEP_M, 1);
    expect(nearestPointOnLine(STRAIGHT, [0.05, 0]).distanceM).toBeCloseTo(2 * STEP_M, 1);
  });

  it('picks the nearest segment, not the first one that fits', () => {
    // (0.009, 0.002): 222 m from the first segment (t = 0.9) but only 111 m from the second,
    // where t = 0.002 / 0.01 = 0.2. So the answer is 1,111.95 + 0.2 × 1,111.95 = 1,334.34 m.
    const result = nearestPointOnLine(L_SHAPE, [0.009, 0.002]);
    expect(result.distanceM).toBeCloseTo(1.2 * STEP_M, 1);
    expect(result.offsetM).toBeCloseTo(STEP_M / 10, 1);
  });

  it('shrinks longitude by cos(latitude): a 45° diagonal at 60 °N', () => {
    // At 60 °N, cos = 0.5, so 0.02° of longitude = 0.01° of latitude = 1,111.95 m: the segment
    // (0, 60) → (0.02, 60.01) is a 45° diagonal on the flat map. P = (0.02, 60) sits below B, so
    // its foot is halfway: t = 0.5. Haversine length 1,572.41 m → along = 786.21 m, offset 786.27 m.
    // (Without the cos, t would be 0.8; with cos of 60 taken in degrees by mistake, 0.78.)
    const result = nearestPointOnLine(
      [
        [0, 60],
        [0.02, 60.01],
      ],
      [0.02, 60],
    );
    expect(result.distanceM).toBeCloseTo(786.21, 1);
    expect(result.offsetM).toBeCloseTo(786.27, 1);
  });

  it('survives a zero-length segment (the same point twice)', () => {
    const line: LonLat[] = [
      [0, 0],
      [0, 0],
      [0.01, 0],
    ];
    expect(nearestPointOnLine(line, [0.005, 0]).distanceM).toBeCloseTo(STEP_M / 2, 1);
  });

  it('refuses a line with fewer than 2 points', () => {
    expect(() => nearestPointOnLine([[0, 0]], [0, 0])).toThrow(RangeError);
  });
});

describe('sliceLine', () => {
  it('the whole length gives back the original points', () => {
    const piece = sliceLine(STRAIGHT, 0, 2 * STEP_M + 1);
    expect(piece).toHaveLength(3);
    piece.forEach((point, i) => {
      expect(point[0]).toBeCloseTo(STRAIGHT[i][0], 9);
      expect(point[1]).toBeCloseTo(STRAIGHT[i][1], 9);
    });
  });

  it('a middle piece = exact start + the points in between + exact end', () => {
    // 500 m = 0.44966 of the first segment → 0.0044966°; 1,700 m is 588.05 m into the
    // second segment = 0.52885 of it → 0.0152885°.
    const piece = sliceLine(STRAIGHT, 500, 1700);
    expect(piece.map((p) => p[0])).toEqual([
      expect.closeTo(0.0044966, 6),
      0.01,
      expect.closeTo(0.0152885, 6),
    ]);
  });

  it('distances before the start or past the end do not repeat the end points', () => {
    expect(sliceLine(STRAIGHT, -100, 2 * STEP_M + 100)).toHaveLength(3);
  });

  it('a piece with from > to is the same piece, backwards', () => {
    const forwards = sliceLine(STRAIGHT, 500, 1700);
    expect(sliceLine(STRAIGHT, 1700, 500)).toEqual([...forwards].reverse());
  });
});

describe('splitIntoStages', () => {
  const stop = (id: string, day: number, position: LonLat, altitudeM = 1000): StageStop => ({
    id,
    day,
    position,
    altitudeM,
  });

  it('N stops give N − 1 stages, each walked on the arrival day of its end stop', () => {
    // Given out of order on purpose: the function sorts by day. Day 3 is a rest day.
    const stages = splitIntoStages(STRAIGHT, [
      stop('c', 4, [0.02, 0]),
      stop('a', 1, [0, 0]),
      stop('b', 2, [0.01, 0.0005]), // 55.6 m north of the trail
    ]);
    expect(stages.map((s) => [s.fromStopId, s.toStopId, s.day])).toEqual([
      ['a', 'b', 2],
      ['b', 'c', 4],
    ]);
    expect(stages[0].lengthM).toBeCloseTo(STEP_M, 1);
    expect(stages[1].lengthM).toBeCloseTo(STEP_M, 1);
    // Where each stage starts along the trail (used by the flythrough's "jump to day"):
    expect(stages[0].fromDistanceM).toBeCloseTo(0, 6); // at a
    expect(stages[1].fromDistanceM).toBeCloseTo(STEP_M, 1); // at b
    expect(stages[0].path).toEqual([
      [0, 0],
      [0.01, 0],
    ]);
  });

  it('gives each stage its own length, adding up to the trail length', () => {
    // b lands 1.2 × STEP_M along the L (the worked example above), c at the end (2 × STEP_M).
    const stages = splitIntoStages(L_SHAPE, [
      stop('a', 1, [0, 0]),
      stop('b', 2, [0.009, 0.002]),
      stop('c', 3, [0.01, 0.01]),
    ]);
    expect(stages[0].lengthM).toBeCloseTo(1.2 * STEP_M, 1); // a → b = 1,334.34 m
    expect(stages[1].lengthM).toBeCloseTo(0.8 * STEP_M, 1); // b → c = 889.56 m
    const total = stages.reduce((sum, s) => sum + s.lengthM, 0);
    expect(total).toBeCloseTo(2 * STEP_M, 1);
  });

  it('remembers the higher of the two stops altitudes (where the camera aims)', () => {
    const stages = splitIntoStages(STRAIGHT, [
      stop('low', 1, [0, 0], 2800),
      stop('high', 2, [0.01, 0], 3440),
      stop('down', 3, [0.02, 0], 3000),
    ]);
    expect(stages.map((s) => s.topAltitudeM)).toEqual([3440, 3440]);
  });

  it('two stops at the same place on the trail give a 0 m stage (TrekPanel shows no button)', () => {
    // Both stops lie past the end of the line, so both land on its last point.
    const stages = splitIntoStages(STRAIGHT, [stop('a', 1, [0.021, 0]), stop('b', 2, [0.022, 0])]);
    expect(stages[0].lengthM).toBe(0);
    expect(stages[0].path).toEqual([
      [0.02, 0],
      [0.02, 0],
    ]);
  });

  it('throws on a line with fewer than 2 points, so useRoutes can report a bad file', () => {
    expect(() => splitIntoStages([[0, 0]], [stop('a', 1, [0, 0])])).toThrow(RangeError);
  });

  it('an out-and-back trek walks the trail backwards on the way down', () => {
    const stages = splitIntoStages(STRAIGHT, [
      stop('start', 1, [0, 0]),
      stop('top', 2, [0.02, 0]),
      stop('back', 3, [0.01, 0]),
    ]);
    const down = stages[1];
    expect(down.lengthM).toBeCloseTo(STEP_M, 1); // positive, although the distance went down
    expect(down.path[0][0]).toBeCloseTo(0.02, 9); // starts at the top…
    expect(down.path.at(-1)?.[0]).toBeCloseTo(0.01, 9); // …and ends lower down
  });

  it('fewer than 2 stops give no stages', () => {
    expect(splitIntoStages(STRAIGHT, [])).toEqual([]);
    expect(splitIntoStages(STRAIGHT, [stop('a', 1, [0, 0])])).toEqual([]);
  });
});
