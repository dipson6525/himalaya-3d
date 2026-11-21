/**
 * nepalView.ts — where the camera starts, as plain numbers with no Cesium, so it can be tested.
 * Owner: Sparsh Gorkhali. Related FR: FR1 (Nepal in 3D).
 *
 * The camera starts south of Nepal, high above the plains, looking north at the Himalaya. A
 * view from the side shows the mountains' height far better than a view straight down.
 * camera.ts turns these numbers into Cesium calls.
 */

/** A loose rectangle around Nepal in degrees (about 26.3–30.5 °N, 80.0–88.2 °E). */
export const NEPAL_BOUNDS = { west: 80.0, south: 26.3, east: 88.2, north: 30.5 } as const;

/** A camera position and direction, in degrees and metres. */
export interface CameraView {
  /** Longitude of the camera itself, degrees east. */
  lon: number;
  /** Latitude of the camera itself, degrees north. */
  lat: number;
  /** Height above the ellipsoid in metres. */
  heightM: number;
  /** Compass direction the camera faces: 0 = north, 90 = east. */
  headingDeg: number;
  /** Up/down angle: 0 = level with the horizon, -90 = straight down. */
  pitchDeg: number;
}

/** Start view: 450 km up, south of Nepal's centre line, looking north and 35° down. */
export const NEPAL_START_VIEW: CameraView = {
  lon: 84.1,
  lat: 22.8,
  heightM: 450_000,
  headingDeg: 0,
  pitchDeg: -35,
};

/** Mean radius of the Earth in metres (used for small-distance conversions). */
export const EARTH_RADIUS_M = 6_371_000;

/** Metres in one degree of latitude on a sphere: 2πR / 360 ≈ 111.2 km. */
const METRES_PER_DEGREE = (2 * Math.PI * EARTH_RADIUS_M) / 360;

/** Degrees → radians. */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Radians → degrees. */
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Both functions below only make sense for a camera that looks DOWN. */
function requireLookingDown(view: CameraView): void {
  if (!(view.pitchDeg < 0)) {
    throw new RangeError(`pitch must be below 0° (looking down), got ${view.pitchDeg}°`);
  }
}

/**
 * The point on the ground the camera looks at — FLAT-EARTH estimate (easy to do by hand).
 *
 * Looking down at angle |pitch| from height h, the line of sight reaches flat ground a horizontal
 * distance d = h / tan(|pitch|) away. Splitting d along the heading gives a north part
 * d·cos(heading) and an east part d·sin(heading), which we turn into degrees: north metres / 111.19 km
 * per degree, and east metres / (111.19 km × cos(latitude)), because lines of longitude get closer
 * together away from the equator.
 *
 * Over hundreds of kilometres this UNDER-estimates the distance: the real ground curves away
 * below a flat plane (by about d² / 2R, 32 km over 640 km), so the line of sight travels FARTHER
 * before it reaches the ground. lookAtPointOnSphere gives the exact answer.
 */
export function lookAtPoint(view: CameraView): { lon: number; lat: number } {
  requireLookingDown(view);
  const pitchRad = toRadians(Math.abs(view.pitchDeg));
  const headingRad = toRadians(view.headingDeg);
  const groundDistanceM = view.heightM / Math.tan(pitchRad);
  const northM = groundDistanceM * Math.cos(headingRad);
  const eastM = groundDistanceM * Math.sin(headingRad);
  const latRad = toRadians(view.lat);
  return {
    lat: view.lat + northM / METRES_PER_DEGREE,
    lon: view.lon + eastM / (METRES_PER_DEGREE * Math.cos(latRad)),
  };
}

/**
 * The point on the ground the camera looks at — EXACT for a spherical Earth of radius R.
 *
 * Draw the plane through the Earth's centre, the camera and the line of sight. Put the centre at
 * (0, 0) and the camera straight above it at (0, H), with H = R + h. The ray leaves the camera at
 * angle α = |pitch| below the horizontal, so after travelling s it is at (s·cos α, H − s·sin α).
 * It hits the ground when that point is R from the centre:
 *
 *   (s cos α)² + (H − s sin α)² = R²   →   s² − 2Hs·sin α + (H² − R²) = 0
 *   s = H·sin α − √(H²·sin²α − (H² − R²))      (the nearer of the two roots)
 *
 * If the square root's inside is negative the ray misses the Earth (it looks past the horizon).
 * The hit point makes an angle δ = atan2(s cos α, H − s sin α) at the centre: that is the ground
 * distance R·δ in radians. Finally, moving δ along the heading θ from the camera's ground point
 * uses the standard "destination point" formulas of spherical trigonometry:
 *
 *   lat₂ = asin(sin lat₁ · cos δ + cos lat₁ · sin δ · cos θ)
 *   lon₂ = lon₁ + atan2(sin θ · sin δ · cos lat₁, cos δ − sin lat₁ · sin lat₂)
 *
 * Worked example (our start view): h = 450 km, α = 35° → s ≈ 851.3 km along the ray,
 * δ ≈ 0.10967 rad → ground distance ≈ 698.7 km (the flat estimate said 642.7 km), so heading north
 * from 22.8 °N the aim point is about 22.8° + 6.28° ≈ 29.08 °N.
 */
export function lookAtPointOnSphere(view: CameraView): { lon: number; lat: number } {
  requireLookingDown(view);
  const alpha = toRadians(Math.abs(view.pitchDeg));
  const heading = toRadians(view.headingDeg);
  const R = EARTH_RADIUS_M;
  const H = R + view.heightM;

  const b = H * Math.sin(alpha);
  const inside = b * b - (H * H - R * R);
  if (inside < 0) {
    throw new RangeError('the line of sight passes above the horizon and never hits the ground');
  }
  const s = b - Math.sqrt(inside);
  const delta = Math.atan2(s * Math.cos(alpha), H - s * Math.sin(alpha));

  const lat1 = toRadians(view.lat);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(heading),
  );
  const lon2 =
    toRadians(view.lon) +
    Math.atan2(
      Math.sin(heading) * Math.sin(delta) * Math.cos(lat1),
      Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDegrees(lat2), lon: toDegrees(lon2) };
}

/** True if a point lies inside NEPAL_BOUNDS (a loose box that also takes in parts of Tibet and India). */
export function isInsideNepalBounds(point: { lon: number; lat: number }): boolean {
  return (
    point.lon >= NEPAL_BOUNDS.west &&
    point.lon <= NEPAL_BOUNDS.east &&
    point.lat >= NEPAL_BOUNDS.south &&
    point.lat <= NEPAL_BOUNDS.north
  );
}
