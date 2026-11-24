/**
 * ElevationSampler.tsx — React glue: samples the shown trek's profile and tells App.
 * Owner: Dipson Gurung. Related FR: FR4, issue #21.
 *
 * It sits inside CesiumGlobe (so useViewer() gives it the Viewer and its terrain) and renders
 * nothing. The profile strip itself (ProfileStrip.tsx) is outside the globe, so the result
 * goes up to App through `onProfile`, the same pattern as FlythroughLayer.
 */
import { useEffect } from 'react';
import { terrainReady } from '../../engine/terrain';
import { useViewer } from '../../engine/ViewerContext';
import { splitRoute } from '../routes/loadRoutes';
import type { RouteFile } from '../routes/types';
import { loadProfile, type ProfileResult } from './sampleHeights';

/**
 * What the profile strip shows. 'ready' carries the route id it belongs to, so the strip never
 * draws one trek's profile with another trek's stops while the route is changing.
 */
export type ProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'ready'; routeId: string } & ProfileResult)
  | { status: 'error' };

interface ElevationSamplerProps {
  route: RouteFile | null;
  /** Increased by the strip's "Try again" button: sample again after an error. */
  attempt: number;
  onProfile: (state: ProfileState) => void;
}

/** Samples the profile of `route` (cached per route) when the route changes or on a retry. */
export function ElevationSampler({ route, attempt, onProfile }: ElevationSamplerProps) {
  const viewer = useViewer();

  useEffect(() => {
    if (!viewer || !route) return;
    const { route: line } = splitRoute(route);
    const routeId = line.properties.id;
    const trail = line.geometry.coordinates;
    let cancelled = false; // set by the cleanup: a late answer for an old route is ignored

    onProfile({ status: 'loading' });
    terrainReady(viewer)
      .then((provider) => loadProfile(routeId, trail, provider))
      .then((result) => {
        if (!cancelled) onProfile({ status: 'ready', routeId, ...result });
      })
      .catch((error: unknown) => {
        console.error('Could not sample the elevation profile', error);
        if (!cancelled) onProfile({ status: 'error' });
      });

    return () => {
      cancelled = true;
      onProfile({ status: 'idle' });
    };
    // `attempt` is not used inside: it is listed so that a retry runs the effect again.
  }, [viewer, route, attempt, onProfile]);

  return null;
}
