/**
 * types.test.ts — checks the route type guards on a tiny synthetic route.
 * Owner: Unique Ghimire. Related FR: FR2, FR3.
 *
 * The names, positions and altitudes below are made up for testing, not real trek data.
 */
import { describe, expect, it } from 'vitest';
import { isRouteFeature, isStopFeature, type RouteFile } from './types';

const testRoute: RouteFile = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        kind: 'route',
        id: 'test-route',
        name_en: 'Test Route',
        name_ne: 'परीक्षण मार्ग',
        description_en: 'A made-up route used only in tests.',
        description_ne: 'परीक्षणका लागि मात्र बनाइएको मार्ग।',
        geometry_source: 'OSM',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [85.0, 28.0],
          [85.2, 28.1],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        kind: 'stop',
        id: 'stop-a',
        name_en: 'Stop A',
        name_ne: 'स्टप ए',
        day: 1,
        altitude_m: 1000,
        altitude_source: 'TEST',
        description_en: 'Synthetic stop.',
        description_ne: 'परीक्षण बिसौनी।',
      },
      geometry: { type: 'Point', coordinates: [85.0, 28.0] },
    },
  ],
};

describe('route type guards', () => {
  it('pick out the one route feature and the stop features', () => {
    const routes = testRoute.features.filter(isRouteFeature);
    const stops = testRoute.features.filter(isStopFeature);
    expect(routes).toHaveLength(1);
    expect(stops.map((stop) => stop.properties.id)).toEqual(['stop-a']);
  });

  it('let TypeScript use the right geometry type after the check', () => {
    const [route] = testRoute.features.filter(isRouteFeature);
    // route.geometry.coordinates is Position[] here, so indexing twice compiles and works.
    expect(route.geometry.coordinates[1][0]).toBe(85.2);
  });
});
