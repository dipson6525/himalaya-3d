/**
 * ElevationSampler.tsx — React glue: samples the shown trek's profile and tells App.
 * Owner: Dipson Gurung. Related FR: FR4, issue #21.
 *
 * It sits inside CesiumGlobe (so useViewer() gives it the Viewer and its terrain) and renders
 * nothing. The profile strip itself (ElevationProfile.tsx) is outside the globe, so the result
 * goes up to App through `onProfile`, the same pattern as FlythroughLayer.
 */
import { useEffect } from 'react';
import { terrainReady } from '../../engine/terrain';
import { useViewer } from '../../engine/ViewerContext';
import { splitRoute } from '../routes/loadRoutes';
import type { RouteFile } from '../routes/types';
import { loadProfile, type ProfileResult } from './sampleHeights';

/** What the profile strip shows. */
export type ProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'ready' } & ProfileResult)
  | { status: 'error' };

interface ElevationSamplerProps {
  route: RouteFile | null;
  onProfile: (state: ProfileState) => void;
}

/** Samples the profile of `route` (cached per route) whenever the route changes. */
export function ElevationSampler({ route, onProfile }: ElevationSamplerProps) {
  const viewer = useViewer();

  useEffect(() => {
    if (!viewer || !route) return;
    const { route: line } = splitRoute(route);
    const trail = line.geometry.coordinates;
    let cancelled = false; // set by the cleanup: a late answer for an old route is ignored

    onProfile({ status: 'loading' });
    terrainReady(viewer)
      .then((provider) => loadProfile(line.properties.id, trail, provider))
      .then((result) => {
        if (!cancelled) onProfile({ status: 'ready', ...result });
      })
      .catch((error: unknown) => {
        console.error('Could not sample the elevation profile', error);
        if (!cancelled) onProfile({ status: 'error' });
      });

    return () => {
      cancelled = true;
      onProfile({ status: 'idle' });
    };
  }, [viewer, route, onProfile]);

  return null;
}
