/**
 * path.test.ts — flythrough maths: resampling, safe heights, spline, constant speed, heading.
 * Owner: Sparsh Gorkhali. Related FR: FR3, issue #19.
 *
 * Lines on the equator keep the numbers checkable by hand: 0.01° of longitude = 1,111.95 m.
 * Only Cesium's maths classes are used, so this runs in Node without a browser.
 */
import { Cartesian3, Cartographic } from 'cesium';
import { describe, expect, it } from 'vitest';
import { haversineM, type LonLat } from '../../lib/geo/distance';
import {
  AHEAD_M,
  buildFlightPath,
  cameraPose,
  curveDistanceForTrail,
  headingPitchTo,
  pointAt,
  resampleTrail,
  safeHeights,
  smoothAngle,
  smoothValue,
  UP_M,
  wrapTo2Pi,
  wrapToPi,
} from './path';

const DEG = Math.PI / 180;

/** [lon, lat] (degrees) and height of a Cesium position. */
function lonLatHeight(position: Cartesian3): [number, number, number] {
  const c = Cartographic.fromCartesian(position);
  return [c.longitude / DEG, c.latitude / DEG, c.height];
}

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
      resampleTrail([
        [1, 1],
        [1, 1],
      ]),
    ).toThrow(RangeError);
    expect(() => resampleTrail([[1, 1]])).toThrow(RangeError);
  });
});

describe('safeHeights', () => {
  it('takes the highest ground within the window, plus the clearance', () => {
    // window 1: each sample looks at itself and one neighbour each side.
    expect(safeHeights([100, 500, 200, 0, 0, 0], 1, 250)).toEqual([750, 750, 750, 450, 250, 250]);
  });
});

describe('angles', () => {
  it('wrapTo2Pi and wrapToPi', () => {
    expect(wrapTo2Pi(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(wrapTo2Pi(5 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapToPi((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2, 12);
  });

  it('smoothAngle moves 1 − 1/e ≈ 63.2% of the way after one time constant', () => {
    const result = smoothAngle(0, 90 * DEG, 1.5, 1.5);
    expect(result / DEG).toBeCloseTo(90 * (1 - Math.exp(-1)), 6); // 56.89°
  });

  it('smoothAngle turns the short way round, through north', () => {
    // From 350° to 10° is +20° through 0°. Half way (α = 0.5) is 0°, not 180°.
    const tauForHalf = 1 / Math.log(2); // α = 1 − e^(−1/τ) = 0.5 when dt = 1
    const result = smoothAngle(350 * DEG, 10 * DEG, 1, tauForHalf);
    expect(wrapToPi(result) / DEG).toBeCloseTo(0, 6);
  });

  it('after a long time the smoothed angle reaches the target', () => {
    expect(smoothAngle(0, 1, 100, 1)).toBeCloseTo(1, 9);
  });

  it('gives the same result at any frame rate: two half-frames = one whole frame', () => {
    // (1 − α_half)² = (e^(−dt/2τ))² = e^(−dt/τ) = 1 − α_whole
    const half = smoothAngle(smoothAngle(0, 1, 0.05, 1.5), 1, 0.05, 1.5);
    expect(half).toBeCloseTo(smoothAngle(0, 1, 0.1, 1.5), 12);
  });

  it('smoothValue does the same for the pitch (no wrapping round)', () => {
    // From −10° towards −40° for one time constant: −10 − 30 × 0.632 = −28.96°
    expect(smoothValue(-10, -40, 1.5, 1.5)).toBeCloseTo(-10 - 30 * (1 - Math.exp(-1)), 9);
  });
});

describe('headingPitchTo', () => {
  const from = Cartesian3.fromDegrees(85, 28, 1000);

  it('due north is heading 0, due east is heading π/2', () => {
    expect(headingPitchTo(from, Cartesian3.fromDegrees(85, 28.01, 1000)).heading).toBeCloseTo(0, 3);
    expect(headingPitchTo(from, Cartesian3.fromDegrees(85.01, 28, 1000)).heading).toBeCloseTo(
      Math.PI / 2,
      3,
    );
  });

  it('a point below gives a negative pitch', () => {
    // 0.01° east at 28 °N = 1,111.95 × cos 28° = 981.8 m away and 1,000 m lower:
    // pitch = −atan(1000 / 981.8) = −45.5°.
    const { pitch } = headingPitchTo(from, Cartesian3.fromDegrees(85.01, 28, 0));
    expect(pitch / DEG).toBeCloseTo(-45.5, 0);
  });
});

describe('buildFlightPath + pointAt', () => {
  // A trail with very uneven point spacing: 11 m, 11 m, then 1,090 m, then a turn north.
  const uneven: LonLat[] = [
    [0, 0],
    [0.0001, 0],
    [0.0002, 0],
    [0.01, 0],
    [0.01, 0.01],
  ];
  const samples = resampleTrail(uneven);
  const path = buildFlightPath(
    samples,
    samples.points.map(() => 500),
  );

  it('the spline passes through every sample at its height', () => {
    samples.distancesM.forEach((time, k) => {
      const [lon, lat, height] = lonLatHeight(path.spline.evaluate(time));
      expect(lon).toBeCloseTo(samples.points[k][0], 7);
      expect(lat).toBeCloseTo(samples.points[k][1], 7);
      expect(height).toBeCloseTo(500, 3);
    });
  });

  it('the curve is shorter than the trail, because it cuts the corner', () => {
    expect(path.lengthM).toBeLessThan(samples.distancesM.at(-1) ?? 0);
  });

  it('curveDistanceForTrail: same as the trail on the straight part, the curve end at the end', () => {
    expect(curveDistanceForTrail(path, 500)).toBeCloseTo(500, 0); // before the corner
    expect(curveDistanceForTrail(path, samples.distancesM.at(-1) ?? 0)).toBeCloseTo(
      path.lengthM,
      6,
    );
    expect(curveDistanceForTrail(path, -50)).toBe(0); // clamped
  });

  it('equal steps in distance give equal steps on the ground (constant ground speed)', () => {
    // Step 50 m at a time from start to end and measure each step on the ground.
    const steps: number[] = [];
    let previous = lonLatHeight(pointAt(path, 0));
    for (let s = 50; s <= path.lengthM; s += 50) {
      const next = lonLatHeight(pointAt(path, s));
      steps.push(haversineM([previous[0], previous[1]], [next[0], next[1]]));
      previous = next;
    }
    // Every step is 50 m to within 2 %: at the start and end, across the uneven part, and
    // around the 90° corner. (Without the curve's distance table, the steps here ranged from
    // 37.5 m to 62.5 m: ease-in at the ends and a short cut across the corner.) The small
    // remaining error is a 50 m chord across a bend being a little shorter than the bend.
    expect(Math.min(...steps)).toBeGreaterThan(49);
    expect(Math.max(...steps)).toBeLessThan(51);
  });

  it('keeps distances outside the path on its ends', () => {
    expect(lonLatHeight(pointAt(path, -100))[0]).toBeCloseTo(0, 7);
    expect(lonLatHeight(pointAt(path, path.lengthM + 100))[1]).toBeCloseTo(0.01, 7);
  });

  it('refuses mismatched heights', () => {
    expect(() => buildFlightPath(samples, [1, 2])).toThrow(RangeError);
  });
});

describe('cameraPose', () => {
  // A trail going straight north for 0.05° (5.6 km), flight line at 1,000 m.
  const north: LonLat[] = [
    [85, 28],
    [85, 28.05],
  ];
  const samples = resampleTrail(north);
  const path = buildFlightPath(
    samples,
    samples.points.map(() => 1000),
  );

  it('sits UP_M above the flight line, looks north and slightly down', () => {
    const pose = cameraPose(path, 2000);
    expect(lonLatHeight(pose.position)[2]).toBeCloseTo(1000 + UP_M, 0);
    expect(wrapToPi(pose.heading)).toBeCloseTo(0, 2);
    // 300 m higher than a point (600 + 800) = 1,400 m ahead: about −12°.
    expect(pose.pitch / DEG).toBeCloseTo(-Math.atan(UP_M / 1400) / DEG, 0);
  });

  it('at the very end it still looks forward (the look-ahead point is clamped to the end)', () => {
    const pose = cameraPose(path, path.lengthM - AHEAD_M / 2);
    expect(wrapToPi(pose.heading)).toBeCloseTo(0, 2);
    expect(pose.pitch).toBeLessThan(0);
  });
});
