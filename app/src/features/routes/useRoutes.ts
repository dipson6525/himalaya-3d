/**
 * useRoutes.ts — React hook that loads the route index and the currently shown route.
 * Owner: Sparsh Gorkhali (loading), Dipson Gurung (it feeds the trek selector, #16). FR2.
 *
 * Until the trek selector (#16) exists, the first route in the index is shown. The hook reports
 * a status so the side panel can say "loading", "no data yet" or "could not load".
 */
import { useEffect, useState } from 'react';
import { fetchRoute, fetchRouteIndex, type RouteSummary } from './loadRoutes';
import type { RouteFile } from './types';

export type RoutesStatus = 'loading' | 'ready' | 'error';

export interface RoutesState {
  status: RoutesStatus;
  routes: RouteSummary[];
  /** The route being shown, or null if there are no routes (or it is still loading). */
  current: RouteFile | null;
}

/** Load data/routes/index.json once, then the first route in it (if any). */
export function useRoutes(): RoutesState {
  const [state, setState] = useState<RoutesState>({ status: 'loading', routes: [], current: null });

  useEffect(() => {
    let cancelled = false; // set by the cleanup, so late answers after unmount are ignored
    async function load() {
      try {
        const routes = await fetchRouteIndex();
        const current = routes.length > 0 ? await fetchRoute(routes[0].id) : null;
        if (!cancelled) setState({ status: 'ready', routes, current });
      } catch (error) {
        console.error('Could not load routes', error);
        if (!cancelled) setState({ status: 'error', routes: [], current: null });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
