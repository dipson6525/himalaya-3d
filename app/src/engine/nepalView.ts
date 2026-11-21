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

/**
 * The point on the ground the camera is looking at, using a flat-earth approximation.
 *
 * Looking down at angle |pitch| from height h, the line of sight reaches the ground a horizontal
 * distance d = h / tan(|pitch|) away. Splitting d along the heading gives a north part
 * d·cos(heading) and an east part d·sin(heading), which we turn into degrees: north metres / 111.2 km
 * per degree, and east metres / (111.2 km × cos(latitude)), because lines of longitude get closer
 * together away from the equator.
 *
 * Over hundreds of kilometres the real, curved Earth drops away below a flat line (about
 * d² / 2R: 32 km over 640 km), so the true point is a little nearer. That is fine for checking
 * that the camera looks at Nepal; it is not used to place anything on the map.
 */
export function lookAtPoint(view: CameraView): { lon: number; lat: number } {
  const pitchRad = (Math.abs(view.pitchDeg) * Math.PI) / 180;
  const headingRad = (view.headingDeg * Math.PI) / 180;
  const groundDistanceM = view.heightM / Math.tan(pitchRad);
  const northM = groundDistanceM * Math.cos(headingRad);
  const eastM = groundDistanceM * Math.sin(headingRad);
  const latRad = (view.lat * Math.PI) / 180;
  return {
    lat: view.lat + northM / METRES_PER_DEGREE,
    lon: view.lon + eastM / (METRES_PER_DEGREE * Math.cos(latRad)),
  };
}

/** True if a point lies inside NEPAL_BOUNDS. */
export function isInsideNepalBounds(point: { lon: number; lat: number }): boolean {
  return (
    point.lon >= NEPAL_BOUNDS.west &&
    point.lon <= NEPAL_BOUNDS.east &&
    point.lat >= NEPAL_BOUNDS.south &&
    point.lat <= NEPAL_BOUNDS.north
  );
}
