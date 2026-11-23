/**
 * resample.test.ts — equal-interval samples along a trail (used by the flythrough and the profile).
 * Owner: Sparsh Gorkhali. Lines on the equator: 0.01° = 1,111.95 m.
 */
import { describe, expect, it } from 'vitest';
import type { LonLat } from './distance';
import { resampleTrail } from './resample';

describe('resampleTrail', () => {
  it('cuts the trail into equal intervals of at most the spacing, ending exactly at the end', () => {
    const trail: LonLat[] = [
      [0, 0],
      [0.02, 0],
    ]; // 2,223.90 m → ceil(2223.90 / 1000) = 3 intervals of 741.30 m
    const samples = resampleTrail(trail, 1000);
    expect(samples.distancesM.map(Math.round)).toEqual([0, 741, 1483, 2224]);
    // A third of the way along: 0.02° / 3 = 0.0066667°
    expect(samples.points[1][0]).toBeCloseTo(0.0066667, 6);
    expect(samples.points[3]).toEqual([0.02, 0]);
  });

  it('refuses a bad spacing and a trail with no length', () => {
    const trail: LonLat[] = [
      [0, 0],
      [0.01, 0],
    ];
    expect(() => resampleTrail(trail, 0)).toThrow(RangeError);
    expect(() =>
      resampleTrail(
        [
          [1, 1],
          [1, 1],
        ],
        100,
      ),
    ).toThrow(RangeError);
    expect(() => resampleTrail([[1, 1]], 100)).toThrow(RangeError);
  });
});
