/**
 * ElevationProfile.tsx — the elevation profile strip under the globe: a Chart.js line chart of
 * terrain height along the trek, the overnight stops marked on it, and the totals (ascent,
 * descent, highest point).
 * Owner: Dipson Gurung. Related FR: FR4, issue #21. Layout: docs/ui-design.md (profile strip).
 *
 * Chart.js draws on a <canvas> outside React, like Cesium: the chart is created in an effect
 * and destroyed in its cleanup, and only the parts that are needed are registered (smaller
 * download). A canvas means nothing to a screen reader, so it gets role="img" and a one-line
 * summary, and the totals are also written out as text.
 *
 * The strip can be hidden (Hide / Show); on narrow screens (≤ 900 px) it starts hidden.
 */
import {
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t, type Language } from '../../i18n';
import { splitRoute } from '../routes/loadRoutes';
import type { RouteFile } from '../routes/types';
import type { ProfileState } from './ElevationSampler';
import { stopsOnProfile, type ProfileStop } from './profile';

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Filler);

const LINE_COLOR = '#ff6b35'; // the trail's orange on the globe
const STOP_COLOR = '#ffd166'; // the stop markers' yellow on the globe
const AXIS_COLOR = '#a9c1d4'; // --muted in styles.css
const GRID_COLOR = 'rgba(169, 193, 212, 0.2)';

interface ElevationProfileProps {
  state: ProfileState;
  route: RouteFile | null;
  language: Language;
}

/** "1,234" — whole metres with a thousands separator. */
const metres = (value: number) => Math.round(value).toLocaleString('en');
/** "12.3" — kilometres with one decimal. */
const km = (valueM: number) => (valueM / 1000).toFixed(1);

/** The profile strip: header with Hide / Show, status or totals, the chart, the data source. */
export function ElevationProfile({ state, route, language }: ElevationProfileProps) {
  const [expanded, setExpanded] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(max-width: 900px)').matches,
  );
  const canvas = useRef<HTMLCanvasElement>(null);
  const ready = state.status === 'ready' ? state : null;

  // The stops on the profile, with names in the current language.
  const stops: ProfileStop[] = useMemo(() => {
    if (!ready || !route) return [];
    const { route: line, stops: features } = splitRoute(route);
    const inputs = features.map((stop) => ({
      id: stop.properties.id,
      label: language === 'ne' ? stop.properties.name_ne : stop.properties.name_en,
      day: stop.properties.day,
      altitudeM: stop.properties.altitude_m,
      position: stop.geometry.coordinates,
    }));
    return stopsOnProfile(line.geometry.coordinates, inputs, ready.profile);
  }, [ready, route, language]);

  // Create the chart when there is a profile and the strip is open; destroy it in the cleanup.
  useEffect(() => {
    if (!ready || !expanded || !canvas.current) return;
    const chart = new Chart(canvas.current, {
      type: 'line',
      data: {
        datasets: [
          {
            data: ready.profile.points.map((p) => ({ x: p.distanceM / 1000, y: p.heightM })),
            borderColor: LINE_COLOR,
            backgroundColor: 'rgba(255, 107, 53, 0.15)',
            borderWidth: 2,
            fill: 'start',
            pointRadius: 0, // hundreds of samples: no dots, just the line
            pointHoverRadius: 3,
          },
          {
            data: stops.map((s) => ({ x: s.distanceM / 1000, y: s.profileHeightM })),
            showLine: false,
            clip: false, // the first and last stops sit on the chart's edges: draw them whole
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: STOP_COLOR,
            pointBorderColor: '#000',
          },
        ],
      },
      options: {
        animation: false, // draw at once (and keep tests and slow laptops fast)
        responsive: true,
        maintainAspectRatio: false, // fill the strip's height
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: ready.profile.lengthM / 1000,
            title: { display: true, text: t('profile.axisDistance', language), color: AXIS_COLOR },
            ticks: { color: AXIS_COLOR },
            grid: { color: GRID_COLOR },
          },
          y: {
            title: { display: true, text: t('profile.axisHeight', language), color: AXIS_COLOR },
            ticks: { color: AXIS_COLOR },
            grid: { color: GRID_COLOR },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => `${items[0].parsed.x?.toFixed(1)} km`,
              label: (item) => {
                if (item.datasetIndex === 1) {
                  const stop = stops[item.dataIndex];
                  return t('profile.stopTooltip', language, {
                    day: stop.day,
                    name: stop.label,
                    altitude: metres(stop.altitudeM),
                  });
                }
                return t('profile.heightTooltip', language, { height: metres(item.parsed.y ?? 0) });
              },
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [ready, stops, expanded, language]);

  if (state.status === 'idle') return null; // no trek shown: no strip (ui-design screen states)

  const name = route ? splitRoute(route).route.properties : null;
  const routeName = name ? (language === 'ne' ? name.name_ne : name.name_en) : '';

  return (
    <section
      className="profile-strip"
      aria-labelledby="profile-heading"
      data-testid="elevation-profile"
      data-status={state.status}
      data-samples={ready ? ready.profile.points.length : 0}
    >
      <div className="profile-header">
        <h2 id="profile-heading">{t('profile.heading', language)}</h2>
        {ready && (
          <p className="profile-stats">
            {t('profile.stats', language, {
              ascent: metres(ready.profile.ascentM),
              descent: metres(ready.profile.descentM),
              highest: metres(ready.profile.highest.heightM),
              at: km(ready.profile.highest.distanceM),
            })}
          </p>
        )}
        <button
          type="button"
          className="profile-toggle"
          aria-expanded={expanded}
          aria-controls="profile-body"
          onClick={() => setExpanded((open) => !open)}
        >
          {t(expanded ? 'profile.hide' : 'profile.show', language)}
        </button>
      </div>

      <div id="profile-body" className="profile-body" hidden={!expanded}>
        {state.status === 'loading' && <p role="status">{t('profile.loading', language)}</p>}
        {state.status === 'error' && <p role="alert">{t('profile.error', language)}</p>}
        {ready && (
          <>
            {ready.noTerrain && <p className="profile-note">{t('profile.noTerrain', language)}</p>}
            <div className="profile-chart">
              <canvas
                ref={canvas}
                role="img"
                aria-label={t('profile.chartLabel', language, {
                  name: routeName,
                  length: km(ready.profile.lengthM),
                  highest: metres(ready.profile.highest.heightM),
                })}
              />
            </div>
            <p className="profile-note">{t('profile.source', language)}</p>
          </>
        )}
      </div>
    </section>
  );
}
