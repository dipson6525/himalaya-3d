/**
 * FlythroughController.test.ts — the flythrough's life cycle, without a browser or a real globe.
 * Owner: Sparsh Gorkhali. Related FR: FR3, issue #19.
 *
 * How it works without Cesium's Viewer:
 * - `stubViewer()` is a plain object with only the parts the controller touches (camera, scene,
 *   home button event, tracked-entity event). Its events are Cesium's real `Event` class.
 * - `sampleTerrain` is replaced (vi.mock) so each test decides which heights "come back".
 * - requestAnimationFrame is replaced: frames wait in a list and `runFrame(time)` runs them, so a
 *   test can step the animation one frame at a time.
 * The trail is synthetic: straight north from 85 °E 28 °N for 0.05° (5,560 m).
 */
import { Cartesian3, Cartographic, Event, sampleTerrain, type Viewer } from 'cesium';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LonLat } from '../../lib/geo/distance';
import { FlythroughController, type FlythroughStatus } from './FlythroughController';

vi.mock('cesium', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cesium')>();
  return { ...actual, sampleTerrain: vi.fn() };
});

const TRAIL: LonLat[] = [
  [85, 28],
  [85, 28.05],
];

/** Every height that sampleTerrain "returns" in a test (undefined = the tile failed). */
function terrainReturns(height: (index: number) => number | undefined) {
  vi.mocked(sampleTerrain).mockImplementation(async (_provider, _level, places) => {
    places.forEach((place, i) => {
      place.height = height(i) as number;
    });
    return places;
  });
}

/**
 * Hold sampleTerrain "in flight" until the returned function is called. A gate promise works
 * even if the test releases it before the controller has called sampleTerrain at all.
 */
function holdTerrain(height: number) {
  let openGate = () => {};
  const gate = new Promise<void>((resolve) => (openGate = resolve));
  vi.mocked(sampleTerrain).mockImplementation(async (_provider, _level, places) => {
    await gate;
    places.forEach((place) => (place.height = height));
    return places;
  });
  return openGate;
}

function stubViewer(groundUnderCamera?: number) {
  return {
    terrainProvider: {}, // "ready" (terrainReady does not wait)
    isDestroyed: () => false,
    camera: { setView: vi.fn(), cancelFlight: vi.fn() },
    scene: {
      requestRender: vi.fn(),
      screenSpaceCameraController: { enableInputs: true },
      globe: { getHeight: () => groundUnderCamera, terrainProviderChanged: new Event() },
    },
    homeButton: { viewModel: { command: { beforeExecute: new Event() } } },
    trackedEntityChanged: new Event(),
  };
}

let frames: FrameRequestCallback[] = [];
/** Run the animation frames that are waiting, as if the browser drew at time `now` (ms). */
function runFrame(now: number) {
  const due = frames;
  frames = [];
  due.forEach((callback) => callback(now));
}

/** A controller on the stub viewer, plus every status it reported. */
function setUp(viewer = stubViewer()) {
  const reports: { status: FlythroughStatus; distanceM: number }[] = [];
  const controller = new FlythroughController(
    viewer as unknown as Viewer,
    TRAIL,
    (status, distanceM) => reports.push({ status, distanceM }),
  );
  const statuses = () => reports.map((r) => r.status);
  return { viewer, controller, reports, statuses };
}

/** Height (m) and position of the camera in setView call number `n` (0 = first). */
function viewAt(viewer: ReturnType<typeof stubViewer>, n: number) {
  const call = vi.mocked(viewer.camera.setView).mock.calls[n][0] as {
    destination: Cartesian3;
    orientation: { heading: number; pitch: number };
  };
  return {
    destination: call.destination,
    height: Cartographic.fromCartesian(call.destination).height,
    pitch: call.orientation.pitch,
  };
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  vi.mocked(sampleTerrain).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FlythroughController', () => {
  it('prepares once, plays, moves the camera from the first frames, and pauses', async () => {
    terrainReturns(() => 1000);
    const { viewer, controller, reports, statuses } = setUp();

    await controller.play();
    expect(statuses()).toEqual(['preparing', 'playing']);
    expect(viewer.scene.screenSpaceCameraController.enableInputs).toBe(false); // mouse off
    expect(frames).toHaveLength(1); // exactly one animation loop

    runFrame(1000); // first frame: dt = 0
    runFrame(1100); // 0.1 s at 250 m/s = 25 m
    runFrame(1200); // another 25 m
    const first = viewAt(viewer, 0).destination;
    const third = viewAt(viewer, 2).destination;
    // The camera starts at the trail's start and has moved 50 m (it does not wait 600 m).
    expect(Cartesian3.distance(first, third)).toBeCloseTo(50, 0);

    controller.pause();
    expect(reports.at(-1)).toEqual({ status: 'paused', distanceM: 650 }); // 600 + 2 × 25
    expect(viewer.scene.screenSpaceCameraController.enableInputs).toBe(true); // mouse back
    expect(frames).toHaveLength(0);

    await controller.play(); // resumes where it stopped, without sampling the terrain again
    expect(reports.at(-1)).toEqual({ status: 'playing', distanceM: 650 });
    expect(sampleTerrain).toHaveBeenCalledTimes(1);
  });

  it('pausing while preparing goes back to idle; play again reuses the same preparation', async () => {
    const release = holdTerrain(1000);
    const { controller, statuses } = setUp();

    const firstPlay = controller.play();
    controller.pause();
    expect(statuses()).toEqual(['preparing', 'idle']); // nothing played yet: not "paused"
    const secondPlay = controller.play();
    release();
    await Promise.all([firstPlay, secondPlay]);

    expect(sampleTerrain).toHaveBeenCalledTimes(1);
    expect(statuses()).toEqual(['preparing', 'idle', 'preparing', 'playing']); // one 'playing'
    expect(frames).toHaveLength(1); // and one animation loop
  });

  it('destroy while preparing: nothing plays, no status afterwards, the mouse stays on', async () => {
    const release = holdTerrain(1000);
    const { viewer, controller, statuses } = setUp();

    const play = controller.play();
    controller.destroy();
    release();
    await play;
    controller.pause(); // a late call from an old handler must do nothing

    expect(statuses()).toEqual(['preparing']);
    expect(frames).toHaveLength(0);
    expect(viewer.scene.screenSpaceCameraController.enableInputs).toBe(true);
  });

  it('the home button and following an entity pause it; destroy removes those listeners', async () => {
    terrainReturns(() => 1000);
    const { viewer, controller, statuses } = setUp();

    await controller.play();
    viewer.homeButton.viewModel.command.beforeExecute.raiseEvent();
    expect(statuses().at(-1)).toBe('paused');

    await controller.play();
    viewer.trackedEntityChanged.raiseEvent();
    expect(statuses().at(-1)).toBe('paused');

    controller.destroy();
    expect(viewer.homeButton.viewModel.command.beforeExecute.numberOfListeners).toBe(0);
    expect(viewer.trackedEntityChanged.numberOfListeners).toBe(0);
  });

  it('reaching the end finishes and gives the mouse back; play starts again from the beginning', async () => {
    terrainReturns(() => 1000);
    const { viewer, controller, reports } = setUp();

    await controller.play();
    for (let i = 0; i < 1000 && frames.length > 0; i++) runFrame(1000 + i * 100);

    expect(reports.at(-1)?.status).toBe('finished');
    expect(reports.at(-1)?.distanceM).toBeCloseTo(5560, -1); // the whole 5.56 km
    expect(viewer.scene.screenSpaceCameraController.enableInputs).toBe(true);

    await controller.play();
    expect(reports.at(-1)).toEqual({ status: 'playing', distanceM: 600 }); // camera at the start
  });

  it('a failed terrain tile counts as the HIGHEST height found, not as 0 m', async () => {
    // A whole stretch "failed" (the first 20 samples, about 1.9 km, like one failed tile); the
    // rest are at 3,000 m. Near the start, the ±500 m maximum only sees failed samples.
    terrainReturns((i) => (i < 20 ? undefined : 3000));
    const { viewer, controller } = setUp();

    await controller.play();
    runFrame(1000);
    // Flight line = 3,000 + 250 clearance; camera 300 m above it = 3,550 m.
    expect(viewAt(viewer, 0).height).toBeCloseTo(3550, 0);
  });

  it('shows the error status when no terrain height came back at all', async () => {
    terrainReturns(() => undefined);
    const { controller, statuses } = setUp();
    await controller.play();
    expect(statuses()).toEqual(['preparing', 'error']);
  });

  it('setSpeed: 2× moves twice as far per frame; a speed of 0 is refused', async () => {
    terrainReturns(() => 1000);
    const { controller, reports } = setUp();
    await controller.play();
    controller.setSpeed(2);
    runFrame(1000);
    runFrame(1100); // 0.1 s at 2 × 250 m/s = 50 m
    controller.pause();
    expect(reports.at(-1)).toEqual({ status: 'paused', distanceM: 650 });
    expect(() => controller.setSpeed(0)).toThrow(RangeError);
  });

  it('jumpTo while paused puts the camera there and waits; Resume continues from there', async () => {
    terrainReturns(() => 1000);
    const { viewer, controller, reports } = setUp();
    await controller.play();
    controller.pause();

    await controller.jumpTo(2000); // 2 km along the trail
    // The camera is at 2,000 m, so the "current point" is 600 m further: 2,600 m. (Close to, not
    // exactly: the distance went through the curve's distance table, with rounding at 1e-9 m.)
    expect(reports.at(-1)?.status).toBe('paused');
    expect(reports.at(-1)?.distanceM).toBeCloseTo(2600, 3);
    const lastView = vi.mocked(viewer.camera.setView).mock.calls.length - 1;
    const where = Cartographic.fromCartesian(viewAt(viewer, lastView).destination);
    // 2,000 m north of 28 °N = 28 + 2000 / 111,195 = 28.017986°
    expect((where.latitude * 180) / Math.PI).toBeCloseTo(28.017986, 4);

    await controller.play();
    expect(reports.at(-1)?.status).toBe('playing');
    expect(reports.at(-1)?.distanceM).toBeCloseTo(2600, 3);
  });

  it('jumpTo before the first play prepares the flight line, then waits there', async () => {
    terrainReturns(() => 1000);
    const { controller, reports, statuses } = setUp();
    await controller.jumpTo(1000);
    expect(statuses()).toEqual(['preparing', 'paused']);
    expect(reports.at(-1)?.distanceM).toBeCloseTo(1600, 3);
  });

  it('jumpTo while playing keeps playing from the new place', async () => {
    terrainReturns(() => 1000);
    const { controller, reports, statuses } = setUp();
    await controller.play();
    runFrame(1000);
    await controller.jumpTo(3000);
    expect(statuses().at(-1)).toBe('playing'); // no pause in between
    runFrame(1100); // + 25 m
    controller.pause();
    expect(reports.at(-1)?.status).toBe('paused');
    expect(reports.at(-1)?.distanceM).toBeCloseTo(3625, 3);
  });

  it('the safety guard lifts the camera above loaded terrain and aims down from there', async () => {
    terrainReturns(() => 1000); // planned camera height: 1,000 + 250 + 300 = 1,550 m
    const { viewer, controller } = setUp(stubViewer(5000)); // but the loaded ground is 5,000 m

    await controller.play();
    runFrame(1000);
    const view = viewAt(viewer, 0);
    expect(view.height).toBeCloseTo(5150, 0); // 150 m above the ground under it
    // Looking at the point 1,400 m ahead on the 1,250 m flight line, from 5,150 m:
    // pitch = −atan(3,900 / 1,400) ≈ −70°. Without re-aiming it would stay at about −12°.
    expect((view.pitch * 180) / Math.PI).toBeCloseTo(-70.3, 0);
  });
});
