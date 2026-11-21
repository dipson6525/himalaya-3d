/**
 * nepalView.test.ts — checks that the start camera really looks at Nepal.
 * Owner: Sparsh Gorkhali. Related FR: FR1.
 *
 * Worked numbers for checking by hand: one degree of latitude = 2π × 6,371 km / 360 ≈ 111.19 km.
 */
import { describe, expect, it } from 'vitest';
import {
  NEPAL_BOUNDS,
  NEPAL_START_VIEW,
  isInsideNepalBounds,
  lookAtPoint,
  type CameraView,
} from './nepalView';

describe('lookAtPoint (flat-earth approximation)', () => {
  it('looking 45° down from 1 km up sees a point 1 km north (0.008993° of latitude)', () => {
    const view: CameraView = { lon: 85, lat: 28, heightM: 1000, headingDeg: 0, pitchDeg: -45 };
    const point = lookAtPoint(view);
    expect(point.lat - 28).toBeCloseTo(1000 / 111_194.9, 6);
    expect(point.lon).toBeCloseTo(85, 9);
  });

  it('heading 90° moves the point east, not north', () => {
    const view: CameraView = { lon: 85, lat: 0, heightM: 1000, headingDeg: 90, pitchDeg: -45 };
    const point = lookAtPoint(view);
    expect(point.lat).toBeCloseTo(0, 9);
    expect(point.lon - 85).toBeCloseTo(1000 / 111_194.9, 6); // at the equator cos(lat) = 1
  });

  it('a steeper pitch looks at a nearer point', () => {
    const base: CameraView = { lon: 85, lat: 28, heightM: 1000, headingDeg: 0, pitchDeg: -30 };
    const steep = { ...base, pitchDeg: -60 };
    expect(lookAtPoint(steep).lat).toBeLessThan(lookAtPoint(base).lat);
  });
});

describe('the start view', () => {
  it('looks at a point inside Nepal', () => {
    // By hand: d = 450 km / tan 35° ≈ 642.7 km north → 22.8° + 642.7 / 111.19 ≈ 28.58 °N.
    const target = lookAtPoint(NEPAL_START_VIEW);
    expect(target.lat).toBeCloseTo(28.58, 1);
    expect(isInsideNepalBounds(target)).toBe(true);
  });

  it('stands south of Nepal, so the mountains are seen from the side', () => {
    expect(NEPAL_START_VIEW.lat).toBeLessThan(NEPAL_BOUNDS.south);
    expect(NEPAL_START_VIEW.headingDeg).toBe(0); // facing north
  });

  it('is centred between the west and east edges of Nepal', () => {
    const middle = (NEPAL_BOUNDS.west + NEPAL_BOUNDS.east) / 2;
    expect(NEPAL_START_VIEW.lon).toBeCloseTo(middle, 1);
  });
});
