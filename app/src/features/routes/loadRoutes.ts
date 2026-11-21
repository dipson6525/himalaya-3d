/**
 * loadRoutes.ts — downloads the route index and route files at run time.
 * Owner: Sparsh Gorkhali (with Unique for the data format). Related FR: FR2.
 *
 * vite.config.ts copies data/routes/index.json and *.geojson to "<base>data/routes/". The app
 * first downloads the small index (ids and names) and only downloads a route's full file when
 * it is needed. The files were checked by the Python validator before they were committed
 * (docs/data-schema.md), so here we only check the overall shape.
 */
import {
  isRouteFeature,
  isStopFeature,
  type RouteFeature,
  type RouteFile,
  type StopFeature,
} from './types';

/** Folder of the route files, relative to the site's base URL (must match vite.config.ts). */
export const ROUTES_PATH = 'data/routes/';

/** One entry of data/routes/index.json. */
export interface RouteSummary {
  id: string;
  name_en: string;
  name_ne: string;
}

/** Full URL of a file in the routes folder, e.g. "/himalaya-3d/data/routes/index.json". */
export function routeFileUrl(fileName: string, baseUrl: string = import.meta.env.BASE_URL): string {
  return `${baseUrl}${ROUTES_PATH}${fileName}`;
}

/** Download a JSON file; a missing file or a server error becomes an Error with the URL in it. */
async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not load ${url} (HTTP ${response.status})`);
  return response.json();
}

/** Download data/routes/index.json and return its list of routes. */
export async function fetchRouteIndex(): Promise<RouteSummary[]> {
  const data = await fetchJson(routeFileUrl('index.json'));
  const routes = (data as { routes?: unknown }).routes;
  if (!Array.isArray(routes)) throw new Error('data/routes/index.json has no "routes" list');
  return routes as RouteSummary[];
}

/** Download one route file by its id. */
export async function fetchRoute(id: string): Promise<RouteFile> {
  const data = await fetchJson(routeFileUrl(`${id}.geojson`));
  if ((data as { type?: unknown }).type !== 'FeatureCollection') {
    throw new Error(`${id}.geojson is not a GeoJSON FeatureCollection`);
  }
  return data as RouteFile;
}

/**
 * Split a route file into its one route feature and its stop features (in walking order).
 * Throws if there is no route feature, which the schema validator never lets through.
 */
export function splitRoute(file: RouteFile): { route: RouteFeature; stops: StopFeature[] } {
  const route = file.features.find(isRouteFeature);
  if (!route) throw new Error('route file has no route feature');
  return { route, stops: file.features.filter(isStopFeature) };
}
