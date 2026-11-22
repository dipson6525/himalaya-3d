/**
 * routeEntities.ts — what to draw for a route, as plain data (no Cesium, so it is unit-tested).
 * Owner: Sparsh Gorkhali (drawing), Unique (stop content). Related FR: FR2.
 *
 * RouteLayer.tsx turns this description into Cesium entities. Keeping the "what" here and the
 * "how" (Cesium calls) there means the text of every popup can be tested in Node.
 */
import { t, type Language } from '../../i18n';
import { splitIntoStages, type Stage } from '../../lib/geo/stages';
import { splitRoute } from './loadRoutes';
import type { Position, RouteFile, StopProperties } from './types';

/** One stop marker: where it is, its label and the HTML shown in Cesium's info box. */
export interface StopMarker {
  id: string;
  position: Position;
  label: string;
  descriptionHtml: string;
}

/** Everything RouteLayer draws for one route. */
export interface RouteDrawing {
  id: string;
  name: string;
  trail: Position[];
  stops: StopMarker[];
}

/**
 * Make text safe to put inside HTML. The route data is ours, but escaping is cheap and means a
 * name containing "<" or "&" can never break the popup or inject markup.
 */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** The name or description in the chosen language. */
function inLanguage(props: { name_en: string; name_ne: string }, language: Language): string {
  return language === 'ne' ? props.name_ne : props.name_en;
}

/**
 * The popup for one stop: the name in both languages, then altitude with its source, the day
 * and the description in the chosen language. Cesium shows this HTML in its info box.
 */
export function stopDescriptionHtml(stop: StopProperties, language: Language): string {
  const description = language === 'ne' ? stop.description_ne : stop.description_en;
  const rows = [
    [t('stop.altitude', language), `${stop.altitude_m.toLocaleString('en')} m`],
    [t('stop.source', language), stop.altitude_source],
    [t('stop.day', language), String(stop.day)],
  ];
  return [
    `<p><strong>${escapeHtml(stop.name_en)}</strong> · ${escapeHtml(stop.name_ne)}</p>`,
    '<table>',
    ...rows.map(
      ([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    ),
    '</table>',
    `<p>${escapeHtml(description)}</p>`,
  ].join('');
}

/** Turn a route file into what RouteLayer should draw, in the chosen language. */
export function routeDrawing(file: RouteFile, language: Language): RouteDrawing {
  const { route, stops } = splitRoute(file);
  return {
    id: route.properties.id,
    name: inLanguage(route.properties, language),
    trail: route.geometry.coordinates,
    stops: stops.map((stop) => ({
      id: stop.properties.id,
      position: stop.geometry.coordinates,
      label: inLanguage(stop.properties, language),
      descriptionHtml: stopDescriptionHtml(stop.properties, language),
    })),
  };
}

/**
 * The daily stages of a route (issue #49): the trail cut at each stop, one stage per pair of
 * consecutive stops. The maths is in lib/geo/stages.ts; this only feeds it the file's data.
 */
export function routeStages(file: RouteFile): Stage[] {
  const { route, stops } = splitRoute(file);
  return splitIntoStages(
    route.geometry.coordinates,
    stops.map((stop) => ({
      id: stop.properties.id,
      day: stop.properties.day,
      position: stop.geometry.coordinates,
    })),
  );
}
