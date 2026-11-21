/**
 * nepalView.test.ts — checks the aim-point maths and that the start camera looks towards Nepal.
 * Owner: Sparsh Gorkhali. Related FR: FR1.
 *
 * Worked numbers for checking by hand (sphere, R = 6,371 km):
 *   one degree of latitude = 2π × 6,371 km / 360 ≈ 111.19 km;
 *   one degree of longitude at 28 °N = 111.19 km × cos 28° ≈ 98.18 km.
 */
import { describe, expect, it } from 'vitest';
import {
  NEPAL_BOUNDS,
  NEPAL_START_VIEW,
  isInsideNepalBounds,
  lookAtPoint,
  lookAtPointOnSphere,
  type CameraView,
} from './nepalView';

const METRES_PER_DEGREE = 111_194.93;

describe('lookAtPoint (flat-earth estimate)', () => {
  it('looking 45° down from 1 km up sees a point 1 km north (0.008993° of latitude)', () => {
    const view: CameraView = { lon: 85, lat: 28, heightM: 1000, headingDeg: 0, pitchDeg: -45 };
    const point = lookAtPoint(view);
    expect(point.lat - 28).toBeCloseTo(1000 / METRES_PER_DEGREE, 6);
    expect(point.lon).toBeCloseTo(85, 9);
  });

  it('heading 90° at 28 °N moves 1 km east = 0.010185° of longitude (uses cos 28°)', () => {
    // 1000 m / (111,194.9 m × cos 28°) = 1000 / 98,179 ≈ 0.010185°. Without the cos(latitude)
    // factor (or with cos of degrees instead of radians) this would be wrong.
    const view: CameraView = { lon: 85, lat: 28, heightM: 1000, headingDeg: 90, pitchDeg: -45 };
    const point = lookAtPoint(view);
    expect(point.lat).toBeCloseTo(28, 9);
    expect(point.lon - 85).toBeCloseTo(0.010185, 6);
  });

  it('a steeper pitch looks at a nearer point', () => {
    const base: CameraView = { lon: 85, lat: 28, heightM: 1000, headingDeg: 0, pitchDeg: -30 };
    const steep = { ...base, pitchDeg: -60 };
    expect(lookAtPoint(steep).lat).toBeLessThan(lookAtPoint(base).lat);
  });

  it.each([0, 20])('refuses pitch %s° (the camera is not looking down)', (pitchDeg) => {
    const view: CameraView = { lon: 85, lat: 28, heightM: 1000, headingDeg: 0, pitchDeg };
    expect(() => lookAtPoint(view)).toThrow(RangeError);
  });
});

describe('lookAtPointOnSphere (exact for a round Earth)', () => {
  it('looking straight down sees the point directly below', () => {
    const view: CameraView = { lon: 85, lat: 28, heightM: 450_000, headingDeg: 0, pitchDeg: -90 };
    const point = lookAtPointOnSphere(view);
    expect(point.lat).toBeCloseTo(28, 9);
    expect(point.lon).toBeCloseTo(85, 9);
  });

  it('agrees with the flat estimate to within about half a metre over 1 km', () => {
    // 5 decimal places of a degree ≈ 0.5 m. (They differ by about 0.1 m here: over 1 km the
    // flat estimate's small errors in longitude are still visible at the 6th decimal place.)
    const view: CameraView = { lon: 85, lat: 28, heightM: 1000, headingDeg: 60, pitchDeg: -45 };
    const flat = lookAtPoint(view);
    const round = lookAtPointOnSphere(view);
    expect(round.lat).toBeCloseTo(flat.lat, 5);
    expect(round.lon).toBeCloseTo(flat.lon, 5);
  });

  it('over long distances the aim point is FARTHER than the flat estimate (the ground curves away)', () => {
    expect(lookAtPointOnSphere(NEPAL_START_VIEW).lat).toBeGreaterThan(
      lookAtPoint(NEPAL_START_VIEW).lat,
    );
  });

  it('throws when the line of sight passes above the horizon', () => {
    // From 450 km up the horizon is about 20.9° below level, so 10° down never meets the ground.
    const view: CameraView = { lon: 85, lat: 28, heightM: 450_000, headingDeg: 0, pitchDeg: -10 };
    expect(() => lookAtPointOnSphere(view)).toThrow(RangeError);
  });
});

describe('the start view', () => {
  it('flat estimate: 450 km / tan 35° ≈ 642.7 km north → 22.8° + 5.78° ≈ 28.58 °N', () => {
    expect(lookAtPoint(NEPAL_START_VIEW).lat).toBeCloseTo(28.58, 2);
  });

  it('exact: about 698.7 km of ground → about 29.08 °N, still inside the box around Nepal', () => {
    const target = lookAtPointOnSphere(NEPAL_START_VIEW);
    expect(target.lat).toBeCloseTo(29.08, 2);
    expect(target.lon).toBeCloseTo(NEPAL_START_VIEW.lon, 9); // heading north: longitude unchanged
    expect(isInsideNepalBounds(target)).toBe(true);
  });

  it('stands south of Nepal, so the mountains are seen from the side', () => {
    expect(NEPAL_START_VIEW.lat).toBeLessThan(NEPAL_BOUNDS.south);
    expect(NEPAL_START_VIEW.headingDeg).toBe(0); // facing north
  });

  it('is centred between the west and east edges of the box', () => {
    const middle = (NEPAL_BOUNDS.west + NEPAL_BOUNDS.east) / 2;
    expect(NEPAL_START_VIEW.lon).toBeCloseTo(middle, 1);
  });
});
