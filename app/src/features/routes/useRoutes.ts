/**
 * useRoutes.ts — React hook: the route list, which route is selected, and its loaded file.
 * Owner: Sparsh Gorkhali (loading), Dipson Gurung (trek selector, #16). Related FR: FR2.
 *
 * - On start-up it downloads data/routes/index.json and selects the first route.
 * - select(id) is called by the trek selector: it takes that route from the cache if it was
 *   shown before, otherwise it clears the map and downloads it.
 * - If the user picks another route before a download finishes, the late answer is ignored, so
 *   the map always shows the route that is selected in the list.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRoute, fetchRouteIndex, type RouteSummary } from './loadRoutes';
import { routeDrawing } from './routeEntities';
import type { RouteFile } from './types';

export type RoutesStatus = 'loading' | 'ready' | 'error';

export interface RoutesState {
  status: RoutesStatus;
  routes: RouteSummary[];
  /** Id of the route chosen in the trek selector (null when there are no routes). */
  selectedId: string | null;
  /** The loaded file of the selected route, or null while loading / when there are none. */
  current: RouteFile | null;
  /** Choose a route by id (downloads it if needed). */
  select: (id: string) => void;
}

export function useRoutes(): RoutesState {
  const [status, setStatus] = useState<RoutesStatus>('loading');
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [current, setCurrent] = useState<RouteFile | null>(null);

  // useRef keeps values between renders without causing a re-render when they change.
  const cache = useRef(new Map<string, RouteFile>()); // route files already downloaded
  const latestRequest = useRef<string | null>(null); // the id the user asked for last

  const select = useCallback((id: string) => {
    latestRequest.current = id;
    setSelectedId(id);

    const cached = cache.current.get(id);
    if (cached) {
      setCurrent(cached);
      setStatus('ready');
      return;
    }

    // Clear the map while the new file downloads: it must never show the previous trek
    // under the newly selected name.
    setCurrent(null);
    setStatus('loading');
    async function load() {
      try {
        const file = await fetchRoute(id);
        // Check the file's shape HERE, inside try: if it were only discovered while rendering,
        // the error would blank the whole page (including the medical disclaimer).
        routeDrawing(file, 'en');
        cache.current.set(id, file);
        if (latestRequest.current !== id) return; // the user has picked another route since
        setCurrent(file);
        setStatus('ready');
      } catch (error) {
        console.error(`Could not load route ${id}`, error);
        if (latestRequest.current === id) setStatus('error');
      }
    }
    void load();
  }, []);

  useEffect(() => {
    let cancelled = false; // set by the cleanup, so a late answer after unmount is ignored
    fetchRouteIndex()
      .then((list) => {
        if (cancelled) return;
        setRoutes(list);
        if (list.length > 0) select(list[0].id);
        else setStatus('ready');
      })
      .catch((error: unknown) => {
        console.error('Could not load the route index', error);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
      latestRequest.current = null; // also ignore any route download still running
    };
  }, [select]);

  return { status, routes, selectedId, current, select };
}
