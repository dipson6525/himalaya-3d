/**
 * RouteLayer.tsx — draws the selected route on the globe: the trail and the stop markers.
 * Owner: Sparsh Gorkhali. Related FR: FR2 (route and stops on the map).
 *
 * Everything for one route goes into one Cesium CustomDataSource. Adding the data source shows
 * the route; removing it (in the effect's cleanup) removes every entity at once.
 *
 * - The trail is a polyline with clampToGround: Cesium drapes it over the terrain, so it follows
 *   the valleys instead of cutting through mountains.
 * - Each stop is a point + label clamped to the ground. disableDepthTestDistance = Infinity keeps
 *   markers visible even where a ridge would hide them. Clicking a marker opens Cesium's info
 *   box with the stop's description (routeEntities.ts builds that HTML).
 *
 * Two effects, on purpose:
 * 1. DRAW (runs when the viewer, the route or the language changes): rebuild the data source,
 *    so labels and popups are in the right language.
 * 2. FLY (runs only when the viewer or the route changes): move the camera to the route. A
 *    language switch must not throw the user's view away.
 */
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Math as CesiumMath,
  Color,
  CustomDataSource,
  HeadingPitchRange,
  HeightReference,
  LabelStyle,
  VerticalOrigin,
} from 'cesium';
import { useEffect } from 'react';
import { useViewer } from '../../engine/ViewerContext';
import type { Language } from '../../i18n';
import { routeDrawing } from './routeEntities';
import type { RouteFile } from './types';

const TRAIL_COLOR = Color.fromCssColorString('#ff6b35');
const STOP_COLOR = Color.fromCssColorString('#ffd166');

interface RouteLayerProps {
  route: RouteFile | null;
  language: Language;
  /** Called with the number of stop markers once they are really on the globe (0 when removed). */
  onDrawn?: (stopMarkers: number) => void;
}

/** Draws `route` (or nothing). Renders no HTML of its own. */
export function RouteLayer({ route, language, onDrawn }: RouteLayerProps) {
  const viewer = useViewer();

  // 1. DRAW
  useEffect(() => {
    if (!viewer || !route) return;
    const drawing = routeDrawing(route, language);
    const dataSource = new CustomDataSource(`route-${drawing.id}`);

    dataSource.entities.add({
      id: `trail-${drawing.id}`,
      name: drawing.name,
      polyline: {
        positions: Cartesian3.fromDegreesArray(drawing.trail.flat()),
        clampToGround: true,
        width: 4,
        material: TRAIL_COLOR,
      },
    });
    for (const stop of drawing.stops) {
      dataSource.entities.add({
        id: `stop-${drawing.id}-${stop.id}`,
        name: stop.label,
        description: stop.descriptionHtml,
        position: Cartesian3.fromDegrees(stop.position[0], stop.position[1]),
        point: {
          pixelSize: 10,
          color: STOP_COLOR,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: stop.label,
          font: '14px sans-serif',
          style: LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 3,
          outlineColor: Color.BLACK,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -12),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }

    // dataSources.add finishes a moment later (it returns a Promise). If the cleanup below runs
    // first — React StrictMode does effect → cleanup → effect straight away — remove() would find
    // nothing to remove, and the add would then go through anyway. So when the add finishes we
    // check `removed` and take the data source away again ourselves.
    let removed = false;
    void viewer.dataSources.add(dataSource).then(() => {
      if (viewer.isDestroyed()) return;
      if (removed) {
        viewer.dataSources.remove(dataSource);
        return;
      }
      onDrawn?.(drawing.stops.length);
    });

    return () => {
      removed = true;
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(dataSource); // no-op if the add has not finished yet (see above)
        viewer.scene.requestRender(); // request-render mode: show that the route is gone
      }
      onDrawn?.(0);
    };
  }, [viewer, route, language, onDrawn]);

  // 2. FLY
  useEffect(() => {
    if (!viewer || !route) return;
    const drawing = routeDrawing(route, 'en'); // only the positions are used here
    const sphere = BoundingSphere.fromPoints(Cartesian3.fromDegreesArray(drawing.trail.flat()));
    // Look at the route from the south, 40° down, from three times its radius (at least 5 km).
    const offset = new HeadingPitchRange(
      0,
      CesiumMath.toRadians(-40),
      Math.max(sphere.radius * 3, 5000),
    );
    viewer.camera.flyToBoundingSphere(sphere, { duration: 1.5, offset });
    return () => {
      if (!viewer.isDestroyed()) viewer.camera.cancelFlight();
    };
  }, [viewer, route]);

  return null;
}
