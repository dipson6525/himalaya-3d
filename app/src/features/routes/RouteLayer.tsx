/**
 * RouteLayer.tsx — draws the selected route on the globe: the trail and the stop markers.
 * Owner: Sparsh Gorkhali. Related FR: FR2 (route and stops on the map).
 *
 * Everything for one route goes into one Cesium CustomDataSource. Adding the data source shows
 * the route; removing it (in the effect's cleanup) removes every entity at once, so switching
 * routes or unmounting can never leave old markers behind.
 *
 * - The trail is a polyline with clampToGround: Cesium drapes it over the terrain, so it follows
 *   the valleys instead of cutting through mountains.
 * - Each stop is a point + label clamped to the ground. disableDepthTestDistance = Infinity keeps
 *   markers visible even where a ridge would hide them. Clicking a marker opens Cesium's info
 *   box with the stop's description (routeEntities.ts builds that HTML).
 * - The camera flies to the route when it changes.
 */
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
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
}

/** Draws `route` (or nothing). Renders no HTML of its own. */
export function RouteLayer({ route, language }: RouteLayerProps) {
  const viewer = useViewer();

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

    let removed = false;
    void viewer.dataSources.add(dataSource).then(() => {
      if (removed || viewer.isDestroyed()) return;
      void viewer.flyTo(dataSource, { duration: 1.5 });
    });

    return () => {
      removed = true;
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(dataSource, true); // true = also destroy its entities
        viewer.scene.requestRender();
      }
    };
  }, [viewer, route, language]);

  return null;
}
