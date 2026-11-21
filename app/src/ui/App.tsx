/**
 * App.tsx — top-level page layout: header, 3D globe, side panel and safety disclaimer.
 * Owner: Dipson Gurung (UI). Related FR: all (this is where features are mounted).
 *
 * The medical disclaimer lives in the footer of the layout so it is visible on every
 * screen, as required by our safety rule. Feature panels (trek selector, itinerary,
 * elevation profile, layers) will be added to the side panel in later milestones.
 *
 * Layers that draw on the globe (RouteLayer) are children of CesiumGlobe, so they can reach the
 * Cesium Viewer through ViewerContext (docs/ui-design.md).
 */
import { CesiumGlobe } from '../engine/CesiumGlobe';
import { RouteLayer } from '../features/routes/RouteLayer';
import { routeDrawing } from '../features/routes/routeEntities';
import { useRoutes, type RoutesState } from '../features/routes/useRoutes';
import { t, type Language } from '../i18n';

/** The interface language. Fixed to English until the language toggle (#27). */
const LANGUAGE: Language = 'en';

/** One line telling the user what the globe is showing (or why it shows no trek). */
function routeStatusText(routes: RoutesState, language: Language): string {
  if (routes.status === 'loading') return t('routes.loading', language);
  if (routes.status === 'error') return t('routes.error', language);
  if (!routes.current) return t('routes.none', language);
  const drawing = routeDrawing(routes.current, language);
  return t('routes.showing', language, { name: drawing.name, count: drawing.stops.length });
}

/** The whole application page. */
export function App() {
  const routes = useRoutes();

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('app.title', LANGUAGE)}</h1>
        <p className="tagline">{t('app.tagline', LANGUAGE)}</p>
      </header>

      <main className="app-main">
        <section className="globe-area" aria-label={t('globe.label', LANGUAGE)}>
          <CesiumGlobe>
            <RouteLayer route={routes.current} language={LANGUAGE} />
          </CesiumGlobe>
        </section>
        <aside className="side-panel">
          <p data-testid="route-status">{routeStatusText(routes, LANGUAGE)}</p>
          <p>{t('panel.comingSoon', LANGUAGE)}</p>
        </aside>
      </main>

      <footer className="disclaimer" role="note">
        {t('disclaimer.medical', LANGUAGE)}
      </footer>
    </div>
  );
}
