/**
 * App.tsx — top-level page layout: header, 3D globe, side panel and safety disclaimer.
 * Owner: Dipson Gurung (UI). Related FR: all (this is where features are mounted).
 *
 * The medical disclaimer lives in the footer of the layout so it is visible on every
 * screen, as required by our safety rule. The side panel has three tabs (SidePanel.tsx):
 * Trek (choose a trek, see its stops, play the flythrough), Plan and Layers (later issues).
 *
 * Layers that draw on the globe (RouteLayer, StageLayer, FlythroughLayer) are children of
 * CesiumGlobe, so they can reach the Cesium Viewer through ViewerContext (docs/ui-design.md).
 * State shared by the globe and the panel (the selected route, the selected daily stage, the
 * flythrough controller and its status) lives here and is passed down as props.
 */
import { useCallback, useMemo, useState } from 'react';
import { CesiumGlobe } from '../engine/CesiumGlobe';
import {
  type FlythroughController,
  type FlythroughStatus,
} from '../engine/flythrough/FlythroughController';
import { FlythroughLayer } from '../engine/flythrough/FlythroughLayer';
import { FlythroughControls } from '../features/routes/FlythroughControls';
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
  // and only recomputed when the route changes (useMemo).
  const currentRoute = routes.current;
  const stages = useMemo(() => (currentRoute ? routeStages(currentRoute) : []), [currentRoute]);

  // The highlighted stage is remembered as "which trek, which end stop". Different treks can
  // share stop ids (two treks may both stop at the same village), so the trek id is checked too:
  // a choice made on one trek can never highlight a stage on another. (TrekPanel also clears the
  // choice when the user picks another trek, so it does not come back on return.)
  const [stageChoice, setStageChoice] = useState<{ routeId: string; toStopId: string } | null>(
    null,
  );
  const selectedStageStopId =
    stageChoice && stageChoice.routeId === routes.selectedId ? stageChoice.toStopId : null;
  const selectedStage = stages.find((stage) => stage.toStopId === selectedStageStopId) ?? null;
  // Which stage StageLayer has really drawn (read by the e2e test, like drawnStops).
  const [drawnStage, setDrawnStage] = useState<string | null>(null);

  // Flythrough (#19). The controller is a plain object that moves the camera itself; React only
  // keeps a reference to it and its status (which changes a few times, not every frame).
  const [flythrough, setFlythrough] = useState<FlythroughController | null>(null);
  const [flyStatus, setFlyStatus] = useState<{ status: FlythroughStatus; distanceM: number }>({
    status: 'idle',
    distanceM: 0,
  });
  // useCallback keeps these the same functions between renders, so FlythroughLayer's effect
  // (which lists them as dependencies) does not rebuild the controller on every render.
  const onFlyStatus = useCallback(
    (status: FlythroughStatus, distanceM: number) => setFlyStatus({ status, distanceM }),
    [],
  );
  const onFlyController = useCallback(
    (controller: FlythroughController | null) => setFlythrough(controller),
    [],
  );

  /** Called by TrekPanel: highlight the stage ending at `toStopId` (null = none). */
  function selectStage(toStopId: string | null) {
    // The stage highlight flies the camera to the stage, so a running flythrough pauses first;
    // otherwise both would move the camera at once.
    if (toStopId) flythrough?.pause();
    setStageChoice(toStopId && routes.selectedId ? { routeId: routes.selectedId, toStopId } : null);
  }

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
          onSelectStage={selectStage}
          drawnStage={drawnStage}
        >
          <FlythroughControls
            controller={flythrough}
            status={flyStatus.status}
            distanceM={flyStatus.distanceM}
            language={LANGUAGE}
          />
        </TrekPanel>
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
            <FlythroughLayer
              route={routes.current}
              onController={onFlyController}
              onStatus={onFlyStatus}
            />
          </CesiumGlobe>
        </section>
        <SidePanel tabs={tabs} language={LANGUAGE} />
      </main>

      {/* A plain <footer> keeps its built-in "contentinfo" landmark (docs/ui-design.md, #16). */}
      <footer className="disclaimer">{t('disclaimer.medical', LANGUAGE)}</footer>
    </div>
  );
}
