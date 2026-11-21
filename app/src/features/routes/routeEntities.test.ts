/**
 * routeEntities.test.ts — what RouteLayer draws, checked without Cesium.
 * Owner: Sparsh Gorkhali. Related FR: FR2.
 *
 * The route here is synthetic (made-up names, positions and altitudes), not real trek data.
 */
import { describe, expect, it } from 'vitest';
import { routeFileUrl, splitRoute } from './loadRoutes';
import { escapeHtml, routeDrawing, stopDescriptionHtml } from './routeEntities';
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
