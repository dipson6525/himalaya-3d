/**
 * profile.test.ts — total ascent / descent, highest point, walked totals, stops on the profile
 * (FR4, issue #21). Owner: Dipson Gurung.
 * All heights here are made up for the tests; none is real trek data.
 */
import { describe, expect, it } from 'vitest';
import type { LonLat } from '../../lib/geo/distance';
import {
  buildProfile,
  climbTotals,
  heightAt,
  heightsBetween,
  highestPoint,
  stopsOnProfile,
  walkedTotals,
  type ProfileStopInput,
} from './profile';

describe('climbTotals', () => {
  it('the worked example: ascent 20 m, descent 25 m (summing every step would give 24 and 29)', () => {
    expect(climbTotals([100, 103, 101, 110, 108, 120, 95], 5)).toEqual({
      ascentM: 20,
      descentM: 25,
    });
  });

  it('with no dead band (threshold 0) it is the plain sum of every rise and every drop', () => {
    expect(climbTotals([100, 103, 101, 110, 108, 120, 95], 0)).toEqual({
      ascentM: 24,
      descentM: 29,
    });
  });

  it('a steady climb in small steps counts in full, also when it is not a multiple of 5 m', () => {
    const up = Array.from({ length: 104 }, (_, i) => 1000 + i); // 1,000 → 1,103 in 1 m steps
    expect(climbTotals(up, 5)).toEqual({ ascentM: 103, descentM: 0 });
  });

  it('up to 1,104 m and back down to 1,000 m in 1 m steps: 104 up, 104 down', () => {
    const up = Array.from({ length: 105 }, (_, i) => 1000 + i); // 1,000 … 1,104
    const down = Array.from({ length: 104 }, (_, i) => 1103 - i); // 1,103 … 1,000
    expect(climbTotals([...up, ...down], 5)).toEqual({ ascentM: 104, descentM: 104 });
  });

  it('exactly the threshold counts; just under it does not', () => {
    expect(climbTotals([100, 105], 5)).toEqual({ ascentM: 5, descentM: 0 });
    expect(climbTotals([100, 104.9], 5)).toEqual({ ascentM: 0, descentM: 0 });
  });

  it('wobbles smaller than the threshold around a flat trail count as nothing', () => {
    expect(climbTotals([500, 503, 498, 502, 499, 501, 500], 5)).toEqual({
      ascentM: 0,
      descentM: 0,
    });
  });

  it('ascent − descent = last COUNTED height − first height', () => {
    // Ends with a 2 m dip that is not counted: the last counted height is 3,440, not 3,438.
    const heights = [2800, 2950, 2900, 3440, 3438];
    const { ascentM, descentM } = climbTotals(heights, 5);
    expect(ascentM - descentM).toBe(3440 - 2800);
  });

  it('no heights or one height: nothing climbed', () => {
    expect(climbTotals([])).toEqual({ ascentM: 0, descentM: 0 });
    expect(climbTotals([1234])).toEqual({ ascentM: 0, descentM: 0 });
  });

  it('refuses a missing height and a negative or missing threshold', () => {
    expect(() => climbTotals([100, Number.NaN, 120])).toThrow(RangeError);
    expect(() => climbTotals([100, 120], -1)).toThrow(RangeError);
    expect(() => climbTotals([100, 120], Number.NaN)).toThrow(RangeError);
  });
});

describe('highestPoint and buildProfile', () => {
  it('finds the highest point and where it is (the first of equal highs)', () => {
    const points = [
      { distanceM: 0, heightM: 1000 },
      { distanceM: 50, heightM: 1300 },
      { distanceM: 100, heightM: 1300 },
      { distanceM: 150, heightM: 1100 },
    ];
    expect(highestPoint(points)).toEqual({ distanceM: 50, heightM: 1300 });
  });

  it('builds points, highest point and length', () => {
    const profile = buildProfile([0, 50, 100, 150], [1000, 1300, 1290, 1100]);
    expect(profile.points).toHaveLength(4);
    expect(profile.highest).toEqual({ distanceM: 50, heightM: 1300 });
    expect(profile.lengthM).toBe(150);
  });

  it('refuses distances and heights of different lengths', () => {
    expect(() => buildProfile([0, 50], [1])).toThrow(RangeError);
  });
});

describe('heightAt, heightsBetween and walkedTotals', () => {
  const profile = buildProfile([0, 1000, 2000], [1000, 1500, 1200]);

  it('heightAt interpolates between samples and clamps at the ends', () => {
    expect(heightAt(profile, 500)).toBe(1250); // half way from 1,000 to 1,500
    expect(heightAt(profile, 1500)).toBe(1350); // half way from 1,500 to 1,200
    expect(heightAt(profile, -10)).toBe(1000);
    expect(heightAt(profile, 9999)).toBe(1200);
  });

  it('heightsBetween: start height, samples in between, end height; backwards for the way back', () => {
    expect(heightsBetween(profile, 500, 2000)).toEqual([1250, 1500, 1200]);
    expect(heightsBetween(profile, 2000, 500)).toEqual([1200, 1500, 1250]);
  });

  it('an out-and-back trek counts the way back too', () => {
    // Out to 2,000 m on days 1–2, back to 0 m on day 3. The line once: 500 up, 300 down.
    const stops = [
      { day: 1, distanceM: 0 },
      { day: 2, distanceM: 2000 },
      { day: 3, distanceM: 0 },
    ];
    // Walked: 1,000 → 1,500 → 1,200 → 1,500 → 1,000: 500 + 300 = 800 up, 300 + 500 = 800 down.
    expect(walkedTotals(profile, stops, 5)).toEqual({ ascentM: 800, descentM: 800 });
  });

  it('a one-way trek walked stop to stop gives the same as the line', () => {
    const stops = [
      { day: 2, distanceM: 2000 }, // out of order on purpose: sorted by day
      { day: 1, distanceM: 0 },
    ];
    expect(walkedTotals(profile, stops, 5)).toEqual({ ascentM: 500, descentM: 300 });
  });

  it('with fewer than two stops it is the whole line once', () => {
    expect(walkedTotals(profile, [], 5)).toEqual({ ascentM: 500, descentM: 300 });
  });
});

describe('stopsOnProfile', () => {
  it('places each stop at its distance along the trail, on the terrain line', () => {
    // A trail along the equator, 0.02° (2,223.9 m) long; the profile's distances match it.
    const trail: LonLat[] = [
      [0, 0],
      [0.02, 0],
    ];
    const along = buildProfile([0, 1111.95, 2223.9], [1000, 1500, 1200]);
    const stops: ProfileStopInput[] = [
      { id: 'a', label: 'Stop A', day: 1, altitudeM: 990, position: [0, 0] },
      { id: 'b', label: 'Stop B', day: 2, altitudeM: 1510, position: [0.01, 0.0005] }, // beside it
    ];
    const placed = stopsOnProfile(trail, stops, along);
    expect(placed[0].distanceM).toBeCloseTo(0, 6);
    expect(placed[1].distanceM).toBeCloseTo(1111.95, 1);
    expect(placed[1].profileHeightM).toBeCloseTo(1500, 0); // terrain height, drawn on the line
    expect(placed[1].altitudeM).toBe(1510); // the cited altitude is kept for the tooltip
  });
});
