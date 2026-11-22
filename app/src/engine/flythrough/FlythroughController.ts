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
 */
import { Cartographic, sampleTerrain, type TerrainProvider, type Viewer } from 'cesium';
import type { LonLat } from '../../lib/geo/distance';
import {
  buildFlightPath,
  cameraPose,
  raise,
  resampleTrail,
  safeHeights,
  smoothAngle,
  type FlightPath,
} from './path';

export type FlythroughStatus = 'idle' | 'preparing' | 'playing' | 'paused' | 'finished' | 'error';

/** Ground speed of the camera, in metres per second (a 10 km day takes 40 s). */
export const DEFAULT_SPEED_MPS = 250;
/** Time constant of the heading smoothing, in seconds (see smoothAngle). */
export const HEADING_TAU_S = 1.5;
/** Terrain level of detail used for the flight heights (about 140 m between terrain samples). */
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
  private distanceM = 0;
  private heading: number | null = null; // smoothed heading; null = not started yet
  private frame = 0; // id from requestAnimationFrame, 0 = no frame waiting
  private lastFrameTime = 0; // timestamp of the previous frame, 0 = first frame
  private destroyed = false;

  constructor(
    private readonly viewer: Viewer,
    private readonly trail: readonly LonLat[],
    private readonly onStatus: StatusListener,
  ) {}

  /** Start, or continue after pause(). Starts again from the beginning once finished. */
  async play(): Promise<void> {
    if (this.destroyed || this.status === 'playing' || this.status === 'preparing') return;
    if (!this.path) {
      this.setStatus('preparing');
      try {
        this.path = await this.prepare();
      } catch (error) {
        console.error('Could not prepare the flythrough', error);
        if (!this.destroyed) this.setStatus('error');
        return;
      }
      // While we waited, the route may have changed (destroy) or the user pressed pause.
      if (this.destroyed || this.getStatus() !== 'preparing') return;
    }
    if (this.status === 'finished') {
      this.distanceM = 0;
      this.heading = null;
    }
    this.viewer.camera.cancelFlight(); // stop a fly-to that may still be running
    this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    this.lastFrameTime = 0;
    this.setStatus('playing');
    this.frame = requestAnimationFrame(this.onFrame);
  }

  /**
   * The current status. play() reads it through this method after its `await`: TypeScript
   * narrowed `this.status` before the await and cannot see that pause() may have changed it.
   */
  getStatus(): FlythroughStatus {
    return this.status;
  }

  /** Stop where the camera is; play() continues from here. */
  pause(): void {
    if (this.status !== 'playing' && this.status !== 'preparing') return;
    this.stopFrames();
    this.setStatus('paused');
  }

  /** Stop for good (the route changed or the page closes). Gives the mouse back. */
  destroy(): void {
    this.destroyed = true;
    this.stopFrames();
  }

  /** One animation frame: move forward, place the camera, maybe finish. */
  private readonly onFrame = (now: number) => {
    this.frame = 0;
    if (this.destroyed || this.status !== 'playing' || !this.path) return;
    const dtS = this.lastFrameTime ? Math.min((now - this.lastFrameTime) / 1000, MAX_FRAME_S) : 0;
    this.lastFrameTime = now;

    this.distanceM = Math.min(this.distanceM + DEFAULT_SPEED_MPS * dtS, this.path.lengthM);
    this.placeCamera(this.path, dtS);

    if (this.distanceM >= this.path.lengthM) {
      this.stopFrames();
      this.setStatus('finished');
      return;
    }
    this.frame = requestAnimationFrame(this.onFrame);
  };

  /** Put the camera at the pose for the current distance, with the heading smoothed. */
  private placeCamera(path: FlightPath, dtS: number) {
    const pose = cameraPose(path, this.distanceM);
    this.heading =
      this.heading === null
        ? pose.heading // first frame: look straight along the trail
        : smoothAngle(this.heading, pose.heading, dtS, HEADING_TAU_S);

    let position = pose.position;
    const where = Cartographic.fromCartesian(position);
    const ground = this.viewer.scene.globe.getHeight(where); // undefined if not loaded yet
    if (ground !== undefined && where.height < ground + MIN_ABOVE_GROUND_M) {
      position = raise(position, ground + MIN_ABOVE_GROUND_M - where.height);
    }

    this.viewer.camera.setView({
      destination: position,
      orientation: { heading: this.heading, pitch: pose.pitch, roll: 0 },
    });
    this.viewer.scene.requestRender();
  }

  /** Sample the terrain under the trail once and build the flight line. */
  private async prepare(): Promise<FlightPath> {
    const samples = resampleTrail(this.trail);
    const places = samples.points.map(([lon, lat]) => Cartographic.fromDegrees(lon, lat));
    // Without a token the terrain is a smooth ellipsoid and every height comes back as 0.
    await sampleTerrain(await terrainReady(this.viewer), TERRAIN_LEVEL, places);
    // A tile that failed to load leaves its heights undefined: count them as 0 (the runtime
    // safety net in placeCamera still lifts the camera over real terrain).
    const ground = places.map((place) => (Number.isFinite(place.height) ? place.height : 0));
    return buildFlightPath(samples, safeHeights(ground));
  }

  private stopFrames() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!this.viewer.isDestroyed()) {
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }
  }

  private setStatus(status: FlythroughStatus) {
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
