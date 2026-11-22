/**
 * App.tsx — top-level page layout: header, 3D globe, side panel and safety disclaimer.
 * Owner: Dipson Gurung (UI). Related FR: all (this is where features are mounted).
 *
 * The medical disclaimer lives in the footer of the layout so it is visible on every
 * screen, as required by our safety rule. The side panel has three tabs (SidePanel.tsx):
 * Trek (choose a trek, see its stops), Plan and Layers (filled in by later issues).
 *
 * Layers that draw on the globe (RouteLayer) are children of CesiumGlobe, so they can reach the
 * Cesium Viewer through ViewerContext (docs/ui-design.md). State shared by the globe and the
 * panel (the selected route) lives here and is passed down as props.
 */
import { useState } from 'react';
import { CesiumGlobe } from '../engine/CesiumGlobe';
import { RouteLayer } from '../features/routes/RouteLayer';
import { TrekPanel } from '../features/routes/TrekPanel';
import { useRoutes } from '../features/routes/useRoutes';
import { t, type Language } from '../i18n';
import { SidePanel, type PanelTab } from './SidePanel';

/** The interface language. Fixed to English until the language toggle (#27). */
const LANGUAGE: Language = 'en';

/** The whole application page. */
export function App() {
  const routes = useRoutes();
  // How many stop markers RouteLayer has really put on the globe (also read by the e2e test).
  const [drawnStops, setDrawnStops] = useState(0);

  const tabs: PanelTab[] = [
    {
      id: 'trek',
      labelKey: 'tabs.trek',
      content: <TrekPanel routes={routes} language={LANGUAGE} drawnStops={drawnStops} />,
    },
    { id: 'plan', labelKey: 'tabs.plan', content: <p>{t('plan.comingSoon', LANGUAGE)}</p> },
    { id: 'layers', labelKey: 'tabs.layers', content: <p>{t('layers.comingSoon', LANGUAGE)}</p> },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('app.title', LANGUAGE)}</h1>
        <p className="tagline">{t('app.tagline', LANGUAGE)}</p>
      </header>

      <main className="app-main">
        <section className="globe-area" aria-label={t('globe.label', LANGUAGE)}>
          <CesiumGlobe>
            <RouteLayer route={routes.current} language={LANGUAGE} onDrawn={setDrawnStops} />
          </CesiumGlobe>
        </section>
        <SidePanel tabs={tabs} language={LANGUAGE} />
      </main>

      {/* A plain <footer> keeps its built-in "contentinfo" landmark (docs/ui-design.md, #16). */}
      <footer className="disclaimer">{t('disclaimer.medical', LANGUAGE)}</footer>
    </div>
  );
}
