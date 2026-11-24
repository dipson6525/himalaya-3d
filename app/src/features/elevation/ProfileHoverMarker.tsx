/**
 * ProfileHoverMarker.tsx — links the globe to the elevation profile (FR4, issue #22):
 * - chart → map: a marker on the trail at the distance the user points at on the chart;
 * - map → chart: clicking the trail on the globe sets that distance, so the chart marks it.
 * Owner: Dipson Gurung. The distance is shared through ProfileHoverContext.
 *
 * - The marker is one entity in its own data source (raised to the top, like the stage
 *   highlight). When the distance changes only its position is updated, nothing is rebuilt.
 * - The place for a distance: the trail's cumulative-distance table and binary search (#18).
 * - The place for a click: Cesium's pick tells whether the click hit the trail (a 9 × 9 px box,
 *   since a 4 px line is hard to hit); the globe under the click gives [lon, lat]; the nearest
 *   point of the trail gives the distance (nearestPointOnLine, #49).
 * - It also renders a visually hidden line of text with the marker's state, read by the e2e
 *   tests (the globe itself is a canvas they cannot look inside).
 */
import {
  Cartesian3,
  Cartographic,
  Color,
  ConstantPositionProperty,
  CustomDataSource,
  Entity,
  HeightReference,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Cartesian2,
} from 'cesium';
import { useEffect, useMemo, useRef } from 'react';
import { useViewer } from '../../engine/ViewerContext';
import { cumulativeDistancesM, locateDistance, pointOnSegment } from '../../lib/geo/distance';
import { nearestPointOnLine } from '../../lib/geo/stages';
import { splitRoute } from '../routes/loadRoutes';
import type { RouteFile } from '../routes/types';
import { useProfileHover } from './profileHover';

/** Size of the box around a click in which the trail counts as hit, in pixels. */
const PICK_BOX_PX = 9;

interface ProfileHoverMarkerProps {
  route: RouteFile | null;
}

/** The hover marker on the globe, and clicks on the trail. Renders only a hidden status line. */
export function ProfileHoverMarker({ route }: ProfileHoverMarkerProps) {
  const viewer = useViewer();
  const { highlightM, setHighlightM } = useProfileHover();
  const marker = useRef<Entity | null>(null);

  // The trail and its distance table, once per route.
  const trail = useMemo(() => {
    if (!route) return null;
    const line = splitRoute(route).route;
    const points = line.geometry.coordinates;
    return { id: line.properties.id, points, cumulative: cumulativeDistancesM(points) };
  }, [route]);

  // 1. Create the marker (hidden) and listen for clicks on the trail, once per route.
  useEffect(() => {
    if (!viewer || !trail) return;
    const dataSource = new CustomDataSource('profile-hover');
    marker.current = dataSource.entities.add({
      show: false,
      point: {
        pixelSize: 12,
        color: Color.WHITE,
        outlineColor: Color.fromCssColorString('#ff6b35'),
        outlineWidth: 3,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    let removed = false;
    void viewer.dataSources.add(dataSource).then(() => {
      if (viewer.isDestroyed()) return;
      if (removed) viewer.dataSources.remove(dataSource);
      else viewer.dataSources.raiseToTop(dataSource);
    });

    const clicks = new ScreenSpaceEventHandler(viewer.scene.canvas);
    clicks.setInputAction((click: { position: Cartesian2 }) => {
      const picked: unknown = viewer.scene.pick(click.position, PICK_BOX_PX, PICK_BOX_PX);
      const hitTrail =
        typeof picked === 'object' &&
        picked !== null &&
        'id' in picked &&
        picked.id instanceof Entity &&
        picked.id.id === `trail-${trail.id}`;
      if (!hitTrail) return;
      // Where on the ground was clicked: the terrain under the click, else the ellipsoid.
      const ray = viewer.camera.getPickRay(click.position);
      const ground =
        (ray && viewer.scene.globe.pick(ray, viewer.scene)) ??
        viewer.camera.pickEllipsoid(click.position);
      if (!ground) return;
      const place = Cartographic.fromCartesian(ground);
      const lonLat: [number, number] = [
        (place.longitude * 180) / Math.PI,
        (place.latitude * 180) / Math.PI,
      ];
      setHighlightM(nearestPointOnLine(trail.points, lonLat, trail.cumulative).distanceM);
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      removed = true;
      clicks.destroy();
      marker.current = null;
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(dataSource);
        viewer.scene.requestRender();
      }
      setHighlightM(null); // a new trek starts with nothing highlighted
    };
  }, [viewer, trail, setHighlightM]);

  // 2. Move (or hide) the marker when the highlighted distance changes.
  useEffect(() => {
    const entity = marker.current;
    if (!viewer || viewer.isDestroyed() || !trail || !entity) return;
    if (highlightM === null) {
      entity.show = false;
    } else {
      const [lon, lat] = pointOnSegment(trail.points, locateDistance(trail.cumulative, highlightM));
      entity.position = new ConstantPositionProperty(Cartesian3.fromDegrees(lon, lat));
      entity.show = true;
    }
    viewer.scene.requestRender(); // request-render mode: show the change
  }, [viewer, trail, highlightM]);

  return (
    <span
      className="visually-hidden"
      data-testid="hover-marker"
      data-shown={highlightM !== null}
      data-distance={highlightM === null ? '' : Math.round(highlightM)}
    />
  );
}
