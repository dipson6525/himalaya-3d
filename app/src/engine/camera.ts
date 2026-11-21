/**
 * camera.ts — puts the Cesium camera over Nepal and makes the home button come back here.
 * Owner: Sparsh Gorkhali. Related FR: FR1.
 *
 * The numbers live in nepalView.ts (tested without Cesium); this file only turns them into
 * Cesium calls.
 */
import { Cartesian3, Math as CesiumMath, type Viewer } from 'cesium';
import { NEPAL_START_VIEW } from './nepalView';

/**
 * Move the camera to the Nepal start view: jump there at once (durationS = 0) or fly there.
 *
 * Cesium wants angles in radians, so degrees are converted with CesiumMath.toRadians.
 * No requestRender() is needed: even in request-render mode, Cesium checks every frame whether
 * the camera moved and redraws if it did, and a flight is driven by Cesium itself.
 */
export function viewNepal(viewer: Viewer, durationS = 0): void {
  const destination = Cartesian3.fromDegrees(
    NEPAL_START_VIEW.lon,
    NEPAL_START_VIEW.lat,
    NEPAL_START_VIEW.heightM,
  );
  const orientation = {
    heading: CesiumMath.toRadians(NEPAL_START_VIEW.headingDeg),
    pitch: CesiumMath.toRadians(NEPAL_START_VIEW.pitchDeg),
    roll: 0,
  };
  if (durationS === 0) {
    viewer.camera.setView({ destination, orientation });
  } else {
    viewer.camera.flyTo({ destination, orientation, duration: durationS });
  }
}

/**
 * Make Cesium's home button (the house icon) fly back to the Nepal start view instead of
 * showing the whole Earth. Returns a function that removes this behaviour again (for cleanup).
 *
 * Cesium raises `beforeExecute` just before the button's command runs, with an object that has
 * a `cancel` property. Setting `cancel` to true stops Cesium's own "fly home"; we then fly to Nepal.
 */
export function makeHomeButtonShowNepal(viewer: Viewer): () => void {
  const command = viewer.homeButton?.viewModel.command;
  if (!command) return () => {};
  return command.beforeExecute.addEventListener((info: { cancel: boolean }) => {
    info.cancel = true;
    viewNepal(viewer, 1.5);
  });
}
