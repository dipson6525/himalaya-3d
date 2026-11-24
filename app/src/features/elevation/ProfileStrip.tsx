/**
 * ProfileStrip.tsx — the elevation profile strip under the globe: a Chart.js line chart of
 * terrain height along the trek, the overnight stops marked on it, and the totals (ascent and
 * descent as walked, highest terrain point).
 * Owner: Dipson Gurung. Related FR: FR4, issue #21. Layout: docs/ui-design.md (profile strip).
 *
 * - The header always shows one status line: "Loading…", the error (with Try again), "no terrain"
 *   or the totals. It is one live region that stays on the page, so a screen reader announces
 *   each change, and it is visible even when the chart is hidden.
 * - Without terrain (no Cesium token) there are no heights, so there are no numbers and no chart:
 *   only the notice. Showing "0 m" would present something untrue as a fact.
 * - Chart.js draws on a <canvas> outside React, like Cesium: the chart is created in an effect and
 *   destroyed in its cleanup, and only the parts that are needed are registered (smaller
 *   download). A canvas means nothing to a screen reader, so it gets role="img" and a summary.
 * - The chart can be hidden (Hide / Show); on narrow screens (≤ 900 px) it starts hidden.
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
import { stopsOnProfile, walkedTotals, type ProfileStop } from './profile';

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Filler);

const LINE_COLOR = '#ff6b35'; // the trail's orange on the globe
const STOP_COLOR = '#ffd166'; // the stop markers' yellow on the globe
const AXIS_COLOR = '#a9c1d4'; // --muted in styles.css
const GRID_COLOR = 'rgba(169, 193, 212, 0.2)';

interface ProfileStripProps {
  state: ProfileState;
  route: RouteFile | null;
  language: Language;
  /** Sample again after an error (the "Try again" button). */
  onRetry: () => void;
}

/** "1,234" — whole metres with a thousands separator. */
const metres = (value: number) => Math.round(value).toLocaleString('en');
/** "12.3" — kilometres with one decimal. */
const km = (valueM: number) => (valueM / 1000).toFixed(1);

/** The profile strip: header with status and Hide / Show, then the chart and the data source. */
export function ProfileStrip({ state, route, language, onRetry }: ProfileStripProps) {
  const [expanded, setExpanded] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(max-width: 900px)').matches,
  );
  const canvas = useRef<HTMLCanvasElement>(null);

  const line = route ? splitRoute(route).route : null;
  // The profile to draw: only a sampled one, and only for the trek that is shown now.
  const profile =
    state.status === 'ready' && !state.noTerrain && line && state.routeId === line.properties.id
      ? state.profile
      : null;

  // The stops on the profile, with names in the current language.
  const stops: ProfileStop[] = useMemo(() => {
    if (!profile || !route) return [];
    const { route: trail, stops: features } = splitRoute(route);
    const inputs = features.map((stop) => ({
      id: stop.properties.id,
      label: language === 'ne' ? stop.properties.name_ne : stop.properties.name_en,
      day: stop.properties.day,
      altitudeM: stop.properties.altitude_m,
      position: stop.geometry.coordinates,
    }));
    return stopsOnProfile(trail.geometry.coordinates, inputs, profile);
  }, [profile, route, language]);

  // Totals as walked, stop to stop (the way back of an out-and-back trek counts too).
  const totals = useMemo(() => (profile ? walkedTotals(profile, stops) : null), [profile, stops]);

  // Create the chart when there is a profile and the strip is open; destroy it in the cleanup.
  useEffect(() => {
    if (!profile || !expanded || !canvas.current) return;
    const chart = new Chart(canvas.current, {
      type: 'line',
      data: {
        datasets: [
          {
            data: profile.points.map((p) => ({ x: p.distanceM / 1000, y: p.heightM })),
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
            max: profile.lengthM / 1000,
            title: { display: true, text: t('profile.axisDistance', language), color: AXIS_COLOR },
            ticks: { color: AXIS_COLOR },
            grid: { color: GRID_COLOR },
          },
          y: {
            // Two lines, so the datum fits next to a short chart: "Terrain height (m)" and
            // "above WGS84 ellipsoid" (an array of strings is drawn as separate lines).
            title: {
              display: true,
              text: [t('profile.axisHeight', language), t('profile.axisHeightDatum', language)],
              color: AXIS_COLOR,
            },
            ticks: { color: AXIS_COLOR },
            grid: { color: GRID_COLOR },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) =>
                t('profile.tooltipDistance', language, { km: (items[0].parsed.x ?? 0).toFixed(1) }),
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
  }, [profile, stops, expanded, language]);

  if (state.status === 'idle' || !line) return null; // no trek shown: no strip (ui-design)

  const routeName = language === 'ne' ? line.properties.name_ne : line.properties.name_en;
  const noTerrain = state.status === 'ready' && state.noTerrain;

  /** The one status line in the header. */
  function statusLine(): string {
    if (state.status === 'loading') return t('profile.loading', language);
    if (state.status === 'error') return t('profile.error', language);
    if (noTerrain) return t('profile.noTerrain', language);
    if (profile && totals) {
      return t('profile.stats', language, {
        ascent: metres(totals.ascentM),
        descent: metres(totals.descentM),
        highest: metres(profile.highest.heightM),
        at: km(profile.highest.distanceM),
      });
    }
    return '';
  }

  return (
    <section
      className="profile-strip"
      aria-labelledby="profile-heading"
      data-testid="elevation-profile"
      data-status={state.status}
      data-no-terrain={noTerrain}
      data-samples={profile ? profile.points.length : 0}
    >
      <div className="profile-header">
        <h2 id="profile-heading">{t('profile.heading', language)}</h2>
        <p className="profile-stats" role="status">
          {statusLine()}
        </p>
        {state.status === 'error' && (
          <button type="button" className="profile-toggle" onClick={onRetry}>
            {t('profile.retry', language)}
          </button>
        )}
        {profile && (
          <button
            type="button"
            className="profile-toggle"
            aria-expanded={expanded}
            aria-controls="profile-body"
            onClick={() => setExpanded((open) => !open)}
          >
            {t(expanded ? 'profile.hide' : 'profile.show', language)}
          </button>
        )}
      </div>

      {profile && (
        <div id="profile-body" className="profile-body" hidden={!expanded}>
          <div className="profile-chart">
            <canvas
              ref={canvas}
              role="img"
              aria-label={t('profile.chartLabel', language, {
                name: routeName,
                length: km(profile.lengthM),
                highest: metres(profile.highest.heightM),
              })}
            />
          </div>
          <p className="profile-note">{t('profile.source', language)}</p>
        </div>
      )}
    </section>
  );
}
