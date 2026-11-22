/**
 * TrekPanel.tsx — the "Trek" tab of the side panel: choose a trek, see its overnight stops.
 * Owner: Dipson Gurung. Related FR: FR2 (select a trek; see its route, stops and daily stages),
 * issues #16 and #49.
 *
 * The trek selector is a native <select> with a visible <label>: browsers already make it work
 * with the keyboard (Tab to reach it, arrow keys to change it) and with screen readers, which a
 * hand-made drop-down would have to re-implement.
 *
 * Every stop after the first one is reached by walking a daily stage. Those stops are toggle
 * buttons (aria-pressed): pressing one highlights that day's stage on the globe (StageLayer),
 * pressing it again removes the highlight. The stage length is computed from the trail
 * (lib/geo/stages.ts), never typed into the data.
 */
import { t, type Language } from '../../i18n';
import type { Stage } from '../../lib/geo/stages';
import { routeDrawing } from './routeEntities';
import { splitRoute } from './loadRoutes';
import type { RoutesState } from './useRoutes';

interface TrekPanelProps {
  routes: RoutesState;
  language: Language;
  /** Stop markers RouteLayer has really drawn (exposed for the e2e test as data-drawn-stops). */
  drawnStops: number;
  /** The daily stages of the selected trek (empty while none is loaded). */
  stages: Stage[];
  /** End-stop id of the highlighted stage, or null. */
  selectedStageStopId: string | null;
  /** Highlight the stage ending at this stop (null = no highlight). */
  onSelectStage: (toStopId: string | null) => void;
  /** End-stop id of the stage StageLayer has really drawn (for the e2e test). */
  drawnStage: string | null;
}

/** One line telling the user what the globe is showing (or why it shows no trek). */
function statusText(routes: RoutesState, language: Language): string {
  if (routes.status === 'loading') return t('routes.loading', language);
  if (routes.status === 'error') return t('routes.error', language);
  if (!routes.current) return t('routes.none', language);
  const drawing = routeDrawing(routes.current, language);
  return t('routes.showing', language, { name: drawing.name, count: drawing.stops.length });
}

/** The Trek tab: trek selector, status line and the selected trek's stops and daily stages. */
export function TrekPanel({
  routes,
  language,
  drawnStops,
  stages,
  selectedStageStopId,
  onSelectStage,
  drawnStage,
}: TrekPanelProps) {
  const stops = routes.current ? splitRoute(routes.current).stops : [];

  /** Another trek: forget the highlighted stage (it belongs to the old trek), then load it. */
  function chooseTrek(id: string) {
    onSelectStage(null);
    routes.select(id);
  }

  return (
    <div className="trek-panel">
      <label className="field">
        <span>{t('trek.choose', language)}</span>
        <select
          value={routes.selectedId ?? ''}
          onChange={(event) => chooseTrek(event.target.value)}
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
          {stages.length > 0 && (
            <p className="hint" id="stage-hint">
              {t('stops.hint', language)}
            </p>
          )}
          {/* An ordered list, but without the 1. 2. 3. markers: they would clash with the day
              numbers ("3. Day 4 …"). Screen readers still announce it as a list. */}
          <ol className="stop-list" data-testid="stop-list" data-drawn-stage={drawnStage ?? ''}>
            {stops.map((stop) => {
              const text = t('stops.item', language, {
                day: stop.properties.day,
                name: language === 'ne' ? stop.properties.name_ne : stop.properties.name_en,
                altitude: stop.properties.altitude_m.toLocaleString('en'),
              });
              const stage = stages.find((s) => s.toStopId === stop.properties.id);
              // No button for the first stop (the trek starts there, no stage leads to it), nor
              // for a stop at the same place on the trail as the one before (a 0 m stage: there
              // would be nothing to highlight).
              if (!stage || stage.lengthM === 0) {
                return (
                  <li key={stop.properties.id}>
                    <span className="stop-text">{text}</span>
                  </li>
                );
              }
              const pressed = stage.toStopId === selectedStageStopId;
              return (
                <li key={stop.properties.id}>
                  <button
                    type="button"
                    className="stop-button"
                    aria-pressed={pressed}
                    aria-describedby="stage-hint"
                    onClick={() => onSelectStage(pressed ? null : stage.toStopId)}
                  >
                    <span className="stop-text">{text}</span>
                    <span className="stage-length">
                      {t('stops.stageLength', language, { km: (stage.lengthM / 1000).toFixed(1) })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
