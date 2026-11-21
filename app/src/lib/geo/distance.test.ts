/**
 * distance.test.ts — hand-checkable tests for the geo maths.
 * Owner: Sparsh Gorkhali. Related FR: FR3, FR4.
 *
 * Reference values on a sphere of radius R = 6,371,000 m:
 *   one degree of arc       = 2πR / 360 = 111,194.93 m
 *   a quarter of the Earth  = πR / 2    = 10,007,543.4 m (equator to pole)
 *   half of the Earth       = πR        = 20,015,086.8 m (to the opposite point)
 * Positions are synthetic, not real places.
 */
import { describe, expect, it } from 'vitest';
import {
  EARTH_RADIUS_M,
  cumulativeDistancesM,
  haversineM,
  locateDistance,
  pointOnSegment,
  type LonLat,
} from './distance';

const ONE_DEGREE_M = (2 * Math.PI * EARTH_RADIUS_M) / 360;

describe('haversineM', () => {
  it('is 0 between a point and itself', () => {
    expect(haversineM([85, 28], [85, 28])).toBe(0);
  });

  it('one degree along the equator is 111,194.9 m (the worked example)', () => {
    expect(haversineM([0, 0], [1, 0])).toBeCloseTo(111_194.93, 1);
  });

  it('one degree along a meridian is the same 111,194.9 m', () => {
    expect(haversineM([85, 27], [85, 28])).toBeCloseTo(ONE_DEGREE_M, 1);
  });

  it('one degree of longitude at 60 °N is half as long (cos 60° = 0.5), roughly', () => {
    // Not exactly half: the great circle cuts the corner slightly compared with the parallel.
    expect(haversineM([0, 60], [1, 60])).toBeCloseTo(ONE_DEGREE_M * 0.5, -2);
  });

  it('equator to pole is a quarter of the way round: πR / 2', () => {
    expect(haversineM([0, 0], [0, 90])).toBeCloseTo((Math.PI * EARTH_RADIUS_M) / 2, 0);
  });

  it('to the opposite side of the Earth is πR, without NaN from rounding', () => {
    const d = haversineM([0, 0], [180, 0]);
    expect(Number.isNaN(d)).toBe(false);
    expect(d).toBeCloseTo(Math.PI * EARTH_RADIUS_M, 0);
  });

  it('gives the same answer in both directions', () => {
    const a: LonLat = [85.3, 27.7];
    const b: LonLat = [86.7, 27.9];
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 6);
  });
});

describe('cumulativeDistancesM', () => {
  it('starts at 0 and adds each segment', () => {
    const points: LonLat[] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const cumulative = cumulativeDistancesM(points);
    expect(cumulative[0]).toBe(0);
    expect(cumulative[1]).toBeCloseTo(ONE_DEGREE_M, 1);
    expect(cumulative[2]).toBeCloseTo(2 * ONE_DEGREE_M, 1);
  });

  it('is empty for no points and [0] for one point', () => {
    expect(cumulativeDistancesM([])).toEqual([]);
    expect(cumulativeDistancesM([[85, 28]])).toEqual([0]);
  });
});

describe('locateDistance (for constant ground speed)', () => {
  // Uneven spacing on purpose: segments of 1°, 3° and 1° along the equator.
  const points: LonLat[] = [
    [0, 0],
    [1, 0],
    [4, 0],
    [5, 0],
  ];
  const cumulative = cumulativeDistancesM(points);

  it('half-way along the whole route is in the long middle segment, half-way along it', () => {
    // total = 5°, half = 2.5°; the middle segment runs from 1° to 4°, so t = (2.5 - 1) / 3 = 0.5
    const position = locateDistance(cumulative, 2.5 * ONE_DEGREE_M);
    expect(position.segment).toBe(1);
    expect(position.t).toBeCloseTo(0.5, 9);
    expect(pointOnSegment(points, position)[0]).toBeCloseTo(2.5, 9);
  });

  it('equal steps in distance give equal steps on the ground, however uneven the points', () => {
    const steps = [0, 1, 2, 3, 4, 5].map(
      (degree) => pointOnSegment(points, locateDistance(cumulative, degree * ONE_DEGREE_M))[0],
    );
    steps.forEach((lon, degree) => expect(lon).toBeCloseTo(degree, 6));
  });

  it('exactly on a point returns the start of the next segment', () => {
    expect(locateDistance(cumulative, cumulative[1])).toEqual({ segment: 1, t: 0 });
  });

  it('clamps before the start and past the end', () => {
    expect(locateDistance(cumulative, -10)).toEqual({ segment: 0, t: 0 });
    expect(locateDistance(cumulative, cumulative[3] + 10)).toEqual({ segment: 2, t: 1 });
  });

  it('skips over a zero-length segment (a repeated point)', () => {
    const repeated: LonLat[] = [
      [0, 0],
      [1, 0],
      [1, 0],
      [2, 0],
    ];
    const position = locateDistance(cumulativeDistancesM(repeated), 1.5 * ONE_DEGREE_M);
    expect(position.segment).toBe(2);
    expect(position.t).toBeCloseTo(0.5, 9);
  });

  it('needs at least two points', () => {
    expect(() => locateDistance([0], 0)).toThrow(RangeError);
  });
});
