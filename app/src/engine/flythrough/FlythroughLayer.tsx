/**
 * FlythroughLayer.tsx — React glue: one FlythroughController per shown route.
 * Owner: Sparsh Gorkhali. Related FR: FR3, issue #19.
 *
 * It sits inside CesiumGlobe (so useViewer() gives it the Viewer) and renders nothing. When the
 * route changes, the old controller is destroyed (its animation stops, the mouse works again)
 * and a new one is handed to App through `onController`, so the controls in the side panel can
 * call play() and pause() on it.
 */
import { useEffect } from 'react';
import { useViewer } from '../ViewerContext';
import { splitRoute } from '../../features/routes/loadRoutes';
import type { RouteFile } from '../../features/routes/types';
import { FlythroughController, type StatusListener } from './FlythroughController';

interface FlythroughLayerProps {
  route: RouteFile | null;
  /** Receives the controller for the current route, or null when there is none. */
  onController: (controller: FlythroughController | null) => void;
  onStatus: StatusListener;
}

/** Creates and destroys the flythrough controller as the route changes. Renders no HTML. */
export function FlythroughLayer({ route, onController, onStatus }: FlythroughLayerProps) {
  const viewer = useViewer();

  useEffect(() => {
    if (!viewer || !route) return;
    const trail = splitRoute(route).route.geometry.coordinates;
    const controller = new FlythroughController(viewer, trail, onStatus);
    onController(controller);
    return () => {
      controller.destroy();
      onController(null);
      onStatus('idle', 0);
    };
  }, [viewer, route, onController, onStatus]);

  return null;
}
