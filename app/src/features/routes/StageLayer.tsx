/**
 * StageLayer.tsx — highlights one daily stage (the trail walked on one day) on the globe.
 * Owner: Sparsh Gorkhali. Related FR: FR2 (daily stages), issue #49.
 *
 * The stage is one extra polyline, wider than the trail, yellow with a black edge, clamped to the
 * ground like the trail. The camera then flies to it.
 *
 * Camera height: the trail has no heights, so points built from it sit at sea level. Aiming at
 * sea level on a short stage high in the mountains puts the camera's target below the terrain
 * (code review found this). Measured with World Terrain on a 1.4 km test stage near 4,900 m: the
 * camera ended 13 m above the ground, pressed against the hillside, and the stage was not visible.
 * So the camera aims at the higher of the two stops' cited altitudes (Stage.topAltitudeM) and
 * stays at least 4 km away at 45°, about 2.8 km above that stop; on the same test stage it ended
 * about 3 km above the terrain under it, with the whole stage in view.
 *
 * Drawing order: Cesium draws data sources in the order of viewer.dataSources, later ones on top.
 * (A polyline's zIndex only orders lines INSIDE one data source, so it cannot help here; a first
 * version used it and the trail covered the highlight.) So the stage gets its own data source,
 * raised to the top once it is added, and RouteLayer lowers the trail's data source to the bottom
 * whenever it redraws (for example after a language change).
 *
 * Like RouteLayer, dataSources.add finishes a moment later, so an add that completes after the
 * cleanup has run removes itself again (React StrictMode runs effect → cleanup → effect).
 */
import {
  BoundingSphere,
  Cartesian3,
  Math as CesiumMath,
  Color,
  CustomDataSource,
  HeadingPitchRange,
  PolylineOutlineMaterialProperty,
} from 'cesium';
import { useEffect } from 'react';
import { useViewer } from '../../engine/ViewerContext';
import type { Stage } from '../../lib/geo/stages';

const STAGE_COLOR = Color.fromCssColorString('#ffd166'); // same yellow as the stop markers

interface StageLayerProps {
  stage: Stage | null;
  /** Called with the stage's end-stop id once it is on the globe, and with null when removed. */
  onDrawn?: (toStopId: string | null) => void;
}

/** Draws `stage` (or nothing) and flies the camera to it. Renders no HTML of its own. */
export function StageLayer({ stage, onDrawn }: StageLayerProps) {
  const viewer = useViewer();

  useEffect(() => {
    if (!viewer || !stage) return;
    const positions = Cartesian3.fromDegreesArray(stage.path.flat());

    const dataSource = new CustomDataSource(`stage-${stage.toStopId}`);
    dataSource.entities.add({
      polyline: {
        positions,
        clampToGround: true,
        width: 8, // the trail is 4 px, so the highlight shows on both sides of it as well
        material: new PolylineOutlineMaterialProperty({
          color: STAGE_COLOR,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
        }),
      },
    });

    let removed = false;
    void viewer.dataSources.add(dataSource).then(() => {
      if (viewer.isDestroyed()) return;
      if (removed) {
        viewer.dataSources.remove(dataSource);
        return;
      }
      viewer.dataSources.raiseToTop(dataSource); // drawn after (= on top of) the trail
      viewer.scene.requestRender(); // request-render mode: show the new line
      onDrawn?.(stage.toStopId);
    });

    // Look at the stage from the south, 45° down, from three times its radius (at least 4 km),
    // aiming at the higher stop's altitude instead of sea level (see the header comment).
    const aimPoints = Cartesian3.fromDegreesArrayHeights(
      stage.path.flatMap(([lon, lat]) => [lon, lat, stage.topAltitudeM]),
    );
    const sphere = BoundingSphere.fromPoints(aimPoints);
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: 1.5,
      offset: new HeadingPitchRange(
        0,
        CesiumMath.toRadians(-45),
        Math.max(sphere.radius * 3, 4000),
      ),
    });

    return () => {
      removed = true;
      if (!viewer.isDestroyed()) {
        viewer.camera.cancelFlight();
        viewer.dataSources.remove(dataSource); // no-op if the add has not finished yet (see above)
        viewer.scene.requestRender();
      }
      onDrawn?.(null);
    };
  }, [viewer, stage, onDrawn]);

  return null;
}
