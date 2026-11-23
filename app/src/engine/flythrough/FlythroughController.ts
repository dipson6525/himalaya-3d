/**
 * FlythroughController.ts — plays the flythrough of one route: moves the Cesium camera every frame.
 * Owner: Sparsh Gorkhali. Related FR: FR3 (animated flythrough), issue #19.
 *
 * A plain class, not React state: the camera moves about 60 times a second, and putting that in
 * React would re-render the page every frame (docs/ui-design.md, "per-frame values stay out of
 * React"). The UI calls METHODS (play, pause) and gets told about STATUS changes through the
 * `onStatus` callback, which happen a few times per flythrough, not every frame.
 *
 * Life of a flythrough:
 * - The first play() PREPARES the flight line: it samples the terrain height under the trail
 *   (sampleTerrain, once) and builds the spline and its distance table (path.ts).
 * - While playing, each animation frame moves `distanceM` forward by speed × elapsed seconds,
 *   puts the camera at cameraPose(distanceM) with a smoothed heading, and asks Cesium to render
 *   (request-render mode only draws when asked).
 * - A last safety net: if the terrain under the camera (as far as it is loaded) is higher than
 *   planned, the camera is lifted to MIN_ABOVE_GROUND_M above it.
 * - While playing, the user's mouse is switched off for the camera; otherwise the mouse and the
 *   flythrough would fight over it. pause(), the end and destroy() switch it back on.
 * - setSpeed() changes the ground speed (a multiple of DEFAULT_SPEED_MPS); jumpTo() moves the
 *   camera to a place along the trail, e.g. the start of a day (#20).
 * - Other things that move the camera PAUSE the flythrough: Cesium's home button and following
 *   an entity (double-click on a marker). Otherwise our per-frame setView would silently undo
 *   them (code review found this). Pressing a day in the stop list pauses it too (App.tsx).
 */
import { Cartographic, sampleTerrain, type TerrainProvider, type Viewer } from 'cesium';
import type { LonLat } from '../../lib/geo/distance';
import {
  BEHIND_M,
  buildFlightPath,
  cameraPose,
  curveDistanceForTrail,
  headingPitchTo,
  raise,
  resampleTrail,
  safeHeights,
  smoothAngle,
  smoothValue,
  type FlightPath,
} from './path';

export type FlythroughStatus = 'idle' | 'preparing' | 'playing' | 'paused' | 'finished' | 'error';

/** Ground speed of the camera at "1×", in metres per second (a 10 km day takes 40 s). */
export const DEFAULT_SPEED_MPS = 250;
/** The speeds offered in the controls, as multiples of DEFAULT_SPEED_MPS. */
export const SPEED_CHOICES = [0.5, 1, 2, 4] as const;
/** Time constant of the heading and pitch smoothing, in seconds (see smoothAngle). */
export const HEADING_TAU_S = 1.5;
/**
 * Terrain level of detail used for the flight heights. A level-11 tile is 180° / 2¹¹ = 0.088°
 * (about 9.8 km) tall. Cesium World Terrain is an irregular mesh, so how far apart its heights are
 * inside a tile varies; TODO(team): verify how fine it is over Nepal. The ±500 m maximum, the
 * clearance and the runtime guard are there because this level is coarse.
 */
export const TERRAIN_LEVEL = 11;
/** The camera is never lower than this above the loaded terrain under it, in metres. */
export const MIN_ABOVE_GROUND_M = 150;
/** Longest time step used for one frame, in seconds (after a stall the camera does not jump). */
const MAX_FRAME_S = 0.1;
/** How long play() waits for World Terrain to finish loading, in milliseconds. */
const TERRAIN_WAIT_MS = 20_000;

/** Called whenever the status changes; `distanceM` = how far along the flight line, in metres. */
export type StatusListener = (status: FlythroughStatus, distanceM: number) => void;

export class FlythroughController {
  private status: FlythroughStatus = 'idle';
  private path: FlightPath | null = null;
  /** The one running prepare(), shared if play() is pressed again while it runs. */
  private preparing: Promise<FlightPath> | null = null;
  private distanceM = 0; // the "current point", metres along the flight line
  private speedMps = DEFAULT_SPEED_MPS;
  private heading: number | null = null; // smoothed heading; null = start afresh
  private pitch = 0; // smoothed pitch
  private frame = 0; // id from requestAnimationFrame, 0 = no frame waiting
  private lastFrameTime = 0; // timestamp of the previous frame, 0 = first frame
  private destroyed = false;
  private readonly stopListening: (() => void)[] = []; // removes the Cesium event listeners

  /**
   * `private readonly viewer: Viewer` in the parameter list is TypeScript shorthand: it declares
   * the field AND stores the argument in it (this.viewer = viewer).
   */
  constructor(
    private readonly viewer: Viewer,
    private readonly trail: readonly LonLat[],
    private readonly onStatus: StatusListener,
  ) {
    // Other camera movers win: pause when the home button is pressed or an entity is followed.
    const home = viewer.homeButton?.viewModel.command.beforeExecute;
    if (home) this.stopListening.push(home.addEventListener(() => this.pause()));
    this.stopListening.push(viewer.trackedEntityChanged.addEventListener(() => this.pause()));
  }

  /** Start, or continue after pause(). Starts again from the beginning once finished. */
  async play(): Promise<void> {
    if (this.destroyed || this.status === 'playing' || this.status === 'preparing') return;
    const path = await this.ensurePath();
    if (!path) return; // failed, cancelled, or the user paused while it was preparing
    // Two play() calls can share one preparation; both get here. Only the first may start the
    // animation loop, otherwise there would be two loops moving the camera twice as fast.
    if (this.destroyed || this.getStatus() === 'playing') return;
    if (this.status === 'finished') this.restartFromBeginning(path);
    this.viewer.camera.cancelFlight(); // stop a fly-to that may still be running
    this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    this.lastFrameTime = 0;
    this.setStatus('playing');
    this.frame = requestAnimationFrame(this.onFrame);
  }

  /**
   * Change the speed, as a multiple of DEFAULT_SPEED_MPS (1 = 250 m/s). Takes effect from the
   * next frame, so it works while playing.
   */
  setSpeed(multiplier: number): void {
    if (!(multiplier > 0)) throw new RangeError(`speed must be positive, got ${multiplier}`);
    this.speedMps = DEFAULT_SPEED_MPS * multiplier;
  }

  /**
   * Move the flythrough so the CAMERA is at the place `trailDistanceM` metres along the trail,
   * looking ahead (the "current point" is then BEHIND_M further on). If it was playing it keeps
   * playing from there; otherwise it waits there as 'paused', so Play / Resume starts from there.
   * Prepares the flight line first if that has not happened yet.
   */
  async jumpTo(trailDistanceM: number): Promise<void> {
    if (this.destroyed || this.status === 'preparing') return;
    const path = await this.ensurePath();
    if (!path) return;
    this.distanceM = Math.min(curveDistanceForTrail(path, trailDistanceM) + BEHIND_M, path.lengthM);
    this.heading = null; // look straight along the trail from the new place, no slow turn
    this.viewer.camera.cancelFlight();
    this.placeCamera(path, 0);
    if (this.getStatus() !== 'playing') this.setStatus('paused');
  }

  /**
   * The current status. play() reads it through this method after its `await`: TypeScript
   * narrowed `this.status` before the await and cannot see that pause() may have changed it.
   */
  getStatus(): FlythroughStatus {
    return this.status;
  }

  /**
   * Stop where the camera is; play() continues from here. Pausing while the flight line is still
   * being prepared goes back to 'idle' (nothing has played yet, so "Resume" would be wrong).
   */
  pause(): void {
    // (After destroy() this may still run from an old handler; setStatus then reports nothing.)
    if (this.status === 'preparing') {
      this.setStatus('idle');
      return;
    }
    if (this.status !== 'playing') return;
    this.stopLoopAndGiveMouseBack();
    this.setStatus('paused');
  }

  /** Stop for good (the route changed or the page closes). Gives the mouse back. */
  destroy(): void {
    this.destroyed = true;
    this.stopLoopAndGiveMouseBack();
    for (const stop of this.stopListening) stop();
  }

  /**
   * The flight line, preparing it first if needed (status 'preparing' meanwhile). Returns null if
   * preparing failed (status 'error'), the controller was destroyed, or the status changed while
   * waiting (the user paused, or another call sharing the same preparation got there first).
   */
  private async ensurePath(): Promise<FlightPath | null> {
    if (this.path) return this.path;
    this.setStatus('preparing');
    // Reuse a prepare() that is still running (the user paused and pressed play again),
    // instead of sampling the terrain twice.
    this.preparing ??= this.prepare();
    try {
      const path = await this.preparing;
      // Store it and set the start position once, even if two calls shared the wait.
      if (!this.path) {
        this.path = path;
        this.restartFromBeginning(path);
      }
    } catch (error) {
      console.error('Could not prepare the flythrough', error);
      this.preparing = null; // the next play() tries again
      if (!this.destroyed && this.getStatus() === 'preparing') this.setStatus('error');
      return null;
    }
    if (this.destroyed || this.getStatus() !== 'preparing') return null;
    return this.path;
  }

  /** Back to the start: the camera at the very start of the trail (see cameraPose). */
  private restartFromBeginning(path: FlightPath) {
    this.distanceM = Math.min(BEHIND_M, path.lengthM);
    this.heading = null;
  }

  /**
   * One animation frame: move forward, place the camera, maybe finish.
   * It is an arrow function stored in a field (not a normal method) so that `this` still means
   * this controller when the browser calls it later through requestAnimationFrame.
   */
  private readonly onFrame = (now: number) => {
    this.frame = 0;
    if (this.destroyed || this.status !== 'playing' || !this.path) return;
    const dtS = this.lastFrameTime ? Math.min((now - this.lastFrameTime) / 1000, MAX_FRAME_S) : 0;
    this.lastFrameTime = now;

    this.distanceM = Math.min(this.distanceM + this.speedMps * dtS, this.path.lengthM);
    this.placeCamera(this.path, dtS);

    if (this.distanceM >= this.path.lengthM) {
      this.stopLoopAndGiveMouseBack();
      this.setStatus('finished');
      return;
    }
    this.frame = requestAnimationFrame(this.onFrame);
  };

  /** Put the camera at the pose for the current distance, with heading and pitch smoothed. */
  private placeCamera(path: FlightPath, dtS: number) {
    const pose = cameraPose(path, this.distanceM);

    // Safety lift first, then aim: after lifting, the camera must look down a bit more to still
    // see the same look-ahead point, so heading and pitch are worked out from the lifted spot.
    let position = pose.position;
    const where = Cartographic.fromCartesian(position);
    const ground = this.viewer.scene.globe.getHeight(where); // undefined if not loaded yet
    if (ground !== undefined && where.height < ground + MIN_ABOVE_GROUND_M) {
      position = raise(position, ground + MIN_ABOVE_GROUND_M - where.height);
    }
    const aim = headingPitchTo(position, pose.target);

    if (this.heading === null) {
      // First frame: look straight along the trail, no smoothing.
      this.heading = aim.heading;
      this.pitch = aim.pitch;
    } else {
      this.heading = smoothAngle(this.heading, aim.heading, dtS, HEADING_TAU_S);
      this.pitch = smoothValue(this.pitch, aim.pitch, dtS, HEADING_TAU_S);
    }

    this.viewer.camera.setView({
      destination: position,
      orientation: { heading: this.heading, pitch: this.pitch, roll: 0 },
    });
    this.viewer.scene.requestRender();
  }

  /** Sample the terrain under the trail once and build the flight line. */
  private async prepare(): Promise<FlightPath> {
    const samples = resampleTrail(this.trail);
    const places = samples.points.map(([lon, lat]) => Cartographic.fromDegrees(lon, lat));
    // Without a token the terrain is a smooth ellipsoid and every height comes back as 0.
    await sampleTerrain(await terrainReady(this.viewer), TERRAIN_LEVEL, places);
    // A tile that failed to load leaves its heights undefined. Counting them as 0 m would fly
    // the camera into the mountains there, so use the HIGHEST height found on the route instead:
    // too high is safe, too low is not. If no height came back at all, give up (error line).
    const known = places.map((place) => place.height).filter((h) => Number.isFinite(h));
    if (known.length === 0) throw new Error('no terrain heights could be loaded');
    const highest = Math.max(...known);
    const ground = places.map((place) => (Number.isFinite(place.height) ? place.height : highest));
    return buildFlightPath(samples, safeHeights(ground));
  }

  /** Cancel the waiting animation frame and switch the user's mouse control back on. */
  private stopLoopAndGiveMouseBack() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!this.viewer.isDestroyed()) {
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }
  }

  /** Remember the new status and tell the UI (never after destroy: the UI has moved on). */
  private setStatus(status: FlythroughStatus) {
    if (this.destroyed) return;
    this.status = status;
    this.onStatus(status, this.distanceM);
  }
}

/**
 * The terrain provider, once it exists. With World Terrain, Cesium leaves
 * viewer.terrainProvider undefined until the terrain has finished loading (a few seconds after
 * start-up), so a user who presses Play early must wait for globe.terrainProviderChanged.
 * Gives up after TERRAIN_WAIT_MS (play() then shows the error line).
 */
function terrainReady(viewer: Viewer): Promise<TerrainProvider> {
  const existing = viewer.terrainProvider as TerrainProvider | undefined;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stopListening();
      reject(new Error('the terrain did not load'));
    }, TERRAIN_WAIT_MS);
    const stopListening = viewer.scene.globe.terrainProviderChanged.addEventListener(
      (provider?: TerrainProvider) => {
        if (!provider) return;
        clearTimeout(timer);
        stopListening();
        resolve(provider);
      },
    );
  });
}
