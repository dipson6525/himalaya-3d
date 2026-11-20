/**
 * types.ts — TypeScript types (and two type guards) for a route file in data/routes/*.geojson.
 * Owner: Unique Ghimire (schema), used by Sparsh Gorkhali (drawing, M3). Related FR: FR2, FR3.
 *
 * This mirrors docs/data-schema.md, which the Python validator (data-prep/prep/schema.py)
 * enforces in CI. TypeScript cannot check JSON at runtime, so these types describe files that
 * have ALREADY passed that validator. If the schema changes, update the doc, the validator, its
 * tests and this file in the same pull request.
 */

/** A GeoJSON position: [longitude, latitude] in degrees. Note the order: longitude first. */
export type Position = [longitude: number, latitude: number];

/** Properties of the single route feature (the trail line). */
export interface RouteProperties {
  kind: 'route';
  /** Lowercase words joined by hyphens; equals the file name without ".geojson". */
  id: string;
  name_en: string;
  name_ne: string;
  description_en: string;
  description_ne: string;
  /** Source ID from data/routes/route-sources.md (usually "OSM"). */
  geometry_source: string;
}

/** Properties of one overnight stop. */
export interface StopProperties {
  kind: 'stop';
  /** Lowercase words joined by hyphens; unique within the route. */
  id: string;
  name_en: string;
  name_ne: string;
  /** Trek day on which you arrive and sleep here (1, 2, ...). Nights here = next stop's day − day. */
  day: number;
  /** Altitude in metres, as published in the cited source. */
  altitude_m: number;
  /** Source ID from data/routes/route-sources.md that the altitude comes from. */
  altitude_source: string;
  description_en: string;
  description_ne: string;
}

/** The trail: a LineString feature. */
export interface RouteFeature {
  type: 'Feature';
  properties: RouteProperties;
  geometry: { type: 'LineString'; coordinates: Position[] };
}

/** One overnight stop: a Point feature. */
export interface StopFeature {
  type: 'Feature';
  properties: StopProperties;
  geometry: { type: 'Point'; coordinates: Position };
}

/** A whole route file: exactly one RouteFeature plus two or more StopFeatures, in walking order. */
export interface RouteFile {
  type: 'FeatureCollection';
  features: Array<RouteFeature | StopFeature>;
}

/**
 * Type guards. Because `kind` sits inside `properties`, TypeScript cannot work out on its own that
 * `kind === 'route'` means the geometry is a LineString. These functions tell it: after
 * `if (isRouteFeature(f))`, TypeScript treats `f` as a RouteFeature.
 */
export function isRouteFeature(feature: RouteFeature | StopFeature): feature is RouteFeature {
  return feature.properties.kind === 'route';
}

/** True for a stop feature; after this check TypeScript treats the feature as a StopFeature. */
export function isStopFeature(feature: RouteFeature | StopFeature): feature is StopFeature {
  return feature.properties.kind === 'stop';
}
