/**
 * routeEntities.test.ts — what RouteLayer draws, checked without Cesium.
 * Owner: Sparsh Gorkhali. Related FR: FR2.
 *
 * The route here is synthetic (made-up names, positions and altitudes), not real trek data.
 */
import { describe, expect, it } from 'vitest';
import { routeFileUrl, splitRoute } from './loadRoutes';
import { escapeHtml, routeDrawing, routeStages, stopDescriptionHtml } from './routeEntities';
import type { RouteFile, StopProperties } from './types';

const stopA: StopProperties = {
  kind: 'stop',
  id: 'stop-a',
  name_en: 'Stop A',
  name_ne: 'स्टप ए',
  day: 1,
  altitude_m: 3440,
  altitude_source: 'TEST',
  description_en: 'First synthetic stop.',
  description_ne: 'पहिलो परीक्षण बिसौनी।',
};

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
        description_en: 'Synthetic.',
        description_ne: 'परीक्षण।',
        geometry_source: 'TEST',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [85.0, 28.0],
          [85.2, 28.1],
        ],
      },
    },
    { type: 'Feature', properties: stopA, geometry: { type: 'Point', coordinates: [85.0, 28.0] } },
  ],
};

describe('escapeHtml', () => {
  it('turns HTML special characters into entities', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe(
      '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;',
    );
  });
});

describe('stopDescriptionHtml', () => {
  it('shows both names, the altitude with a thousands separator, the source and the day', () => {
    const html = stopDescriptionHtml(stopA, 'en');
    expect(html).toContain('<strong>Stop A</strong> · स्टप ए');
    expect(html).toContain('<th>Altitude</th><td>3,440 m</td>');
    expect(html).toContain('<th>Altitude source</th><td>TEST</td>');
    expect(html).toContain('<th>Arrive on day</th><td>1</td>');
    expect(html).toContain('First synthetic stop.');
  });

  it('uses Nepali labels and description when the language is Nepali', () => {
    const html = stopDescriptionHtml(stopA, 'ne');
    expect(html).toContain('<th>उचाइ</th>');
    expect(html).toContain('पहिलो परीक्षण बिसौनी।');
  });

  it('escapes text from the data, so a stray "<" cannot inject markup', () => {
    const html = stopDescriptionHtml({ ...stopA, description_en: '<script>x</script>' }, 'en');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('routeDrawing', () => {
  it('lists the trail and one marker per stop, labelled in the chosen language', () => {
    const drawing = routeDrawing(testRoute, 'en');
    expect(drawing.id).toBe('test-route');
    expect(drawing.name).toBe('Test Route');
    expect(drawing.trail).toHaveLength(2);
    expect(drawing.stops.map((stop) => stop.label)).toEqual(['Stop A']);
    expect(routeDrawing(testRoute, 'ne').stops[0].label).toBe('स्टप ए');
  });
});

describe('loadRoutes helpers', () => {
  it('builds route file URLs under the site base', () => {
    expect(routeFileUrl('index.json', '/himalaya-3d/')).toBe('/himalaya-3d/data/routes/index.json');
    expect(routeFileUrl('x.geojson', '/')).toBe('/data/routes/x.geojson');
  });

  it('splits a route file into its route and stops', () => {
    const { route, stops } = splitRoute(testRoute);
    expect(route.properties.id).toBe('test-route');
    expect(stops).toHaveLength(1);
  });

  it('refuses a file without a route feature', () => {
    expect(() => splitRoute({ type: 'FeatureCollection', features: [] })).toThrow();
  });
});

describe('routeStages', () => {
  it('passes the trail and the stops (id, day, position) to the stage maths', () => {
    const withSecondStop: RouteFile = {
      ...testRoute,
      features: [
        ...testRoute.features,
        {
          type: 'Feature',
          properties: { ...stopA, id: 'stop-b', day: 3 },
          geometry: { type: 'Point', coordinates: [85.2, 28.1] },
        },
      ],
    };
    const stages = routeStages(withSecondStop);
    expect(stages).toHaveLength(1);
    expect(stages[0]).toMatchObject({
      fromStopId: 'stop-a',
      toStopId: 'stop-b',
      day: 3,
      topAltitudeM: 3440, // both synthetic stops are at 3,440 m
    });
    expect(stages[0].path).toEqual([
      [85.0, 28.0],
      [85.2, 28.1],
    ]);
  });

  it('a route with one stop has no stages', () => {
    expect(routeStages(testRoute)).toEqual([]);
  });

  it('throws for a trail with only one point (useRoutes then shows "could not load")', () => {
    const broken = structuredClone(testRoute);
    const route = broken.features[0];
    if (route.geometry.type === 'LineString') route.geometry.coordinates = [[85.0, 28.0]];
    expect(() => routeStages(broken)).toThrow(RangeError);
  });
});
