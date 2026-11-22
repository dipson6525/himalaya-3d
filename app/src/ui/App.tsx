/**
 * App.tsx — top-level page layout: header, 3D globe, side panel and safety disclaimer.
 * Owner: Dipson Gurung (UI). Related FR: all (this is where features are mounted).
 *
 * The medical disclaimer lives in the footer of the layout so it is visible on every
 * screen, as required by our safety rule. The side panel has three tabs (SidePanel.tsx):
 * Trek (choose a trek, see its stops), Plan and Layers (filled in by later issues).
 *
 * Layers that draw on the globe (RouteLayer, StageLayer) are children of CesiumGlobe, so they can
 * reach the Cesium Viewer through ViewerContext (docs/ui-design.md). State shared by the globe and
 * the panel (the selected route, the selected daily stage) lives here and is passed down as props.
 */
import { useMemo, useState } from 'react';
import { CesiumGlobe } from '../engine/CesiumGlobe';
import { routeStages } from '../features/routes/routeEntities';
import { RouteLayer } from '../features/routes/RouteLayer';
import { StageLayer } from '../features/routes/StageLayer';
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

  // Daily stages (#49). Computed from the route file, never stored separately ("derived state"),
  // and only recomputed when the route changes (useMemo). The selected stage is remembered by the
  // id of the stop it ends at; TrekPanel clears it when another trek is chosen.
  const currentRoute = routes.current;
  const stages = useMemo(() => (currentRoute ? routeStages(currentRoute) : []), [currentRoute]);
  const [selectedStageStopId, setSelectedStageStopId] = useState<string | null>(null);
  const selectedStage = stages.find((stage) => stage.toStopId === selectedStageStopId) ?? null;
  // Which stage StageLayer has really drawn (read by the e2e test, like drawnStops).
  const [drawnStage, setDrawnStage] = useState<string | null>(null);

  const tabs: PanelTab[] = [
    {
      id: 'trek',
      labelKey: 'tabs.trek',
      content: (
        <TrekPanel
          routes={routes}
          language={LANGUAGE}
          drawnStops={drawnStops}
          stages={stages}
          selectedStageStopId={selectedStageStopId}
          onSelectStage={setSelectedStageStopId}
          drawnStage={drawnStage}
        />
      ),
      hasControls: true,
    },
    {
      id: 'plan',
      labelKey: 'tabs.plan',
      content: <p>{t('plan.comingSoon', LANGUAGE)}</p>,
      hasControls: false,
    },
    {
      id: 'layers',
      labelKey: 'tabs.layers',
      content: <p>{t('layers.comingSoon', LANGUAGE)}</p>,
      hasControls: false,
    },
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
            <StageLayer stage={selectedStage} onDrawn={setDrawnStage} />
          </CesiumGlobe>
        </section>
        <SidePanel tabs={tabs} language={LANGUAGE} />
      </main>

      {/* A plain <footer> keeps its built-in "contentinfo" landmark (docs/ui-design.md, #16). */}
      <footer className="disclaimer">{t('disclaimer.medical', LANGUAGE)}</footer>
    </div>
  );
}
