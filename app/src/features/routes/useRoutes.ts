/**
 * useRoutes.ts — React hook: the route list, which route is selected, and its loaded file.
 * Owner: Sparsh Gorkhali (loading), Dipson Gurung (trek selector, #16). Related FR: FR2.
 *
 * - On start-up it downloads data/routes/index.json and selects the first route.
 * - select(id) is called by the trek selector: if that route file was downloaded before it comes
 *   from the cache; otherwise the map is cleared and the file is downloaded.
 * - Every select() call gets a number. Only the answer to the NEWEST call is used, so a download
 *   that finishes late (the user has chosen something else since) never replaces what is on the
 *   map, even when the user chose the same trek again in between (ADR-026).
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

/**
 * Loads the route index, selects the first route, and lets the trek selector choose another.
 * App calls it once and passes the result to RouteLayer (the globe) and TrekPanel (the panel).
 */
export function useRoutes(): RoutesState {
  const [status, setStatus] = useState<RoutesStatus>('loading');
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [current, setCurrent] = useState<RouteFile | null>(null);

  // useRef keeps values between renders without causing a re-render when they change.
  const cache = useRef(new Map<string, RouteFile>()); // route files already downloaded
  const latestRequest = useRef(0); // number of the newest select() call

  // useCallback with [] keeps `select` the SAME function on every render. That matters because
  // the effect below lists it as a dependency (the hooks lint rule requires that): a new function
  // each render would re-run the effect and download the index again and again.
  const select = useCallback((id: string) => {
    const request = latestRequest.current + 1;
    latestRequest.current = request;
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
        cache.current.set(id, file); // a good file is worth keeping even if it arrived late
        if (latestRequest.current !== request) return; // a newer select() call has happened
        setCurrent(file);
        setStatus('ready');
      } catch (error) {
        console.error(`Could not load route ${id}`, error);
        if (latestRequest.current === request) setStatus('error');
      }
    }
    void load();
  }, []);

  // Runs once after the first render (twice in development, where React's StrictMode mounts,
  // cleans up and mounts again to find missing cleanups; the `cancelled` flag makes that safe).
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
      latestRequest.current += 1; // also ignore any route download still running
    };
  }, [select]);

  return { status, routes, selectedId, current, select };
}
