/**
 * profile.test.ts — total ascent / descent, highest point, stops on the profile (FR4, issue #21).
 * Owner: Dipson Gurung. All heights here are made up for the tests; none is real trek data.
 */
import { describe, expect, it } from 'vitest';
import type { LonLat } from '../../lib/geo/distance';
import {
  buildProfile,
  climbTotals,
  heightAt,
  highestPoint,
  stopsOnProfile,
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

  it('a steady climb in small steps still counts in full', () => {
    const steps = Array.from({ length: 101 }, (_, i) => 1000 + i); // 1,000 → 1,100 in 1 m steps
    expect(climbTotals(steps, 5)).toEqual({ ascentM: 100, descentM: 0 });
  });

  it('wobbles smaller than the threshold around a flat trail count as nothing', () => {
    expect(climbTotals([500, 503, 498, 502, 499, 501, 500], 5)).toEqual({
      ascentM: 0,
      descentM: 0,
    });
  });

  it('ascent − descent = last turning point − first height', () => {
    const heights = [2800, 2950, 2900, 3440, 3400, 3440, 3860, 3440];
    const { ascentM, descentM } = climbTotals(heights, 5);
    expect(ascentM - descentM).toBe(3440 - 2800);
  });

  it('no heights or one height: nothing climbed', () => {
    expect(climbTotals([])).toEqual({ ascentM: 0, descentM: 0 });
    expect(climbTotals([1234])).toEqual({ ascentM: 0, descentM: 0 });
  });

  it('refuses a missing height (NaN) instead of silently giving NaN totals', () => {
    expect(() => climbTotals([100, Number.NaN, 120])).toThrow(RangeError);
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

  it('builds points, totals, highest point and length', () => {
    const profile = buildProfile([0, 50, 100, 150], [1000, 1300, 1290, 1100], 5);
    expect(profile.points).toHaveLength(4);
    expect(profile.ascentM).toBe(300);
    expect(profile.descentM).toBe(200); // 1,300 → 1,100 (the −10 m first is part of it)
    expect(profile.highest).toEqual({ distanceM: 50, heightM: 1300 });
    expect(profile.lengthM).toBe(150);
  });

  it('refuses distances and heights of different lengths', () => {
    expect(() => buildProfile([0, 50], [1])).toThrow(RangeError);
  });
});

describe('heightAt and stopsOnProfile', () => {
  const profile = buildProfile([0, 1000, 2000], [1000, 1500, 1200]);

  it('interpolates between samples and clamps at the ends', () => {
    expect(heightAt(profile, 500)).toBe(1250); // half way from 1,000 to 1,500
    expect(heightAt(profile, 1500)).toBe(1350); // half way from 1,500 to 1,200
    expect(heightAt(profile, -10)).toBe(1000);
    expect(heightAt(profile, 9999)).toBe(1200);
  });

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
