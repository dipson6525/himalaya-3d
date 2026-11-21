/**
 * camera.ts — puts the Cesium camera over Nepal and makes the home button come back here.
 * Owner: Sparsh Gorkhali. Related FR: FR1.
 *
 * The numbers live in nepalView.ts (tested without Cesium); this file only turns them into
 * Cesium calls.
 */
import { Camera, Cartesian3, Math as CesiumMath, Rectangle, type Viewer } from 'cesium';
import { NEPAL_BOUNDS, NEPAL_START_VIEW } from './nepalView';

/**
 * Make Nepal Cesium's default view. Called once at start-up, before any Viewer exists.
 *
 * Camera.DEFAULT_VIEW_RECTANGLE is a global Cesium setting used when a Viewer is created and by
 * the home button in 2D modes. DEFAULT_VIEW_FACTOR = 0 means "show exactly this rectangle"
 * (the default, 0.5, would zoom out to show much more of the Earth).
 */
export function setNepalAsDefaultView(): void {
  Camera.DEFAULT_VIEW_RECTANGLE = Rectangle.fromDegrees(
    NEPAL_BOUNDS.west,
    NEPAL_BOUNDS.south,
    NEPAL_BOUNDS.east,
    NEPAL_BOUNDS.north,
  );
  Camera.DEFAULT_VIEW_FACTOR = 0;
}

/**
 * Move the camera to the Nepal start view: jump there at once (durationS = 0) or fly there.
 *
 * Cesium wants angles in radians, so degrees are converted with CesiumMath.toRadians.
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
  // In request-render mode Cesium only redraws when asked; a camera move must ask.
  viewer.scene.requestRender();
}

/**
 * Make Cesium's home button (the house icon) fly back to the Nepal start view instead of
 * showing the whole Earth. Returns a function that removes this behaviour again (for cleanup).
 *
 * Cesium raises `beforeExecute` just before the button's command runs; setting `cancel` to true
 * stops Cesium's own "fly home", and we fly to Nepal instead.
 */
export function makeHomeButtonShowNepal(viewer: Viewer): () => void {
  const command = viewer.homeButton?.viewModel.command;
  if (!command) return () => {};
  return command.beforeExecute.addEventListener((info: { cancel: boolean }) => {
    info.cancel = true;
    viewNepal(viewer, 1.5);
  });
}
