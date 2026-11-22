/**
 * TrekPanel.tsx — the "Trek" tab of the side panel: choose a trek, see its overnight stops.
 * Owner: Dipson Gurung. Related FR: FR2 (select a trek and see its route and stops), issue #16.
 *
 * The trek selector is a native <select> with a visible <label>: browsers already make it work
 * with the keyboard (Tab to reach it, arrow keys to change it) and with screen readers, which a
 * hand-made drop-down would have to re-implement.
 */
import { t, type Language } from '../../i18n';
import { routeDrawing } from './routeEntities';
import { splitRoute } from './loadRoutes';
import type { RoutesState } from './useRoutes';

interface TrekPanelProps {
  routes: RoutesState;
  language: Language;
  /** Stop markers RouteLayer has really drawn (exposed for the e2e test as data-drawn-stops). */
  drawnStops: number;
}

/** One line telling the user what the globe is showing (or why it shows no trek). */
function statusText(routes: RoutesState, language: Language): string {
  if (routes.status === 'loading') return t('routes.loading', language);
  if (routes.status === 'error') return t('routes.error', language);
  if (!routes.current) return t('routes.none', language);
  const drawing = routeDrawing(routes.current, language);
  return t('routes.showing', language, { name: drawing.name, count: drawing.stops.length });
}

/** The Trek tab: trek selector, status line and the selected trek's overnight stops. */
export function TrekPanel({ routes, language, drawnStops }: TrekPanelProps) {
  const stops = routes.current ? splitRoute(routes.current).stops : [];

  return (
    <div className="trek-panel">
      <label className="field">
        <span>{t('trek.choose', language)}</span>
        <select
          value={routes.selectedId ?? ''}
          onChange={(event) => routes.select(event.target.value)}
          disabled={routes.routes.length === 0}
        >
          {routes.routes.map((route) => (
            <option key={route.id} value={route.id}>
              {language === 'ne' ? route.name_ne : route.name_en}
            </option>
          ))}
        </select>
      </label>

      <p data-testid="route-status" data-drawn-stops={drawnStops} role="status">
        {statusText(routes, language)}
      </p>

      {stops.length > 0 && (
        <>
          <h2 className="panel-heading">{t('stops.heading', language)}</h2>
          {/* An ordered list, but without the 1. 2. 3. markers: they would clash with the day
              numbers ("3. Day 4 …"). Screen readers still announce it as a list. */}
          <ol className="stop-list">
            {stops.map((stop) => (
              <li key={stop.properties.id}>
                {t('stops.item', language, {
                  day: stop.properties.day,
                  name: language === 'ne' ? stop.properties.name_ne : stop.properties.name_en,
                  altitude: stop.properties.altitude_m.toLocaleString('en'),
                })}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
