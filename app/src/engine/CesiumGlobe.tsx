/**
 * CesiumGlobe.tsx — React component that owns one Cesium Viewer (the 3D globe).
 * Owner: Sparsh Gorkhali. Related FR: FR1 (3D terrain view).
 *
 * React and Cesium both want to control the page, so we give Cesium an empty <div> and
 * create the Viewer inside useEffect (which runs after React has put the <div> on screen).
 * The effect's cleanup function destroys the Viewer, which frees its WebGL context.
 * Without that, every remount or hot-reload would leak a WebGL context until the
 * browser refuses to create more.
 *
 * After creating the Viewer we (issue #14):
 *   - point the camera at Nepal from the south (camera.ts, numbers in nepalView.ts);
 *   - make the home button come back to that view;
 *   - add the OpenStreetMap credit next to Cesium's own credits (credits.ts).
 *
 * Request-render mode: by default Cesium redraws the scene about 60 times a second even when
 * nothing moves, which keeps the GPU busy and drains laptop batteries. With
 * requestRenderMode, Cesium redraws only when something changes (camera moved, a tile loaded,
 * an entity added). Code that changes the scene in another way must call
 * viewer.scene.requestRender(). maximumRenderTimeChange: Infinity means "the passing of time
 * alone is never a reason to redraw" (we have no clock animation yet; #28 will revisit this).
 */
import {
  ImageryLayer,
  Terrain,
  TileMapServiceImageryProvider,
  Viewer,
  buildModuleUrl,
} from 'cesium';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { makeHomeButtonShowNepal, viewNepal } from './camera';
import { hasCesiumToken } from './cesiumSetup';
import { addMapDataCredits } from './credits';
import { ViewerContext } from './ViewerContext';

/**
 * Build the Viewer options.
 *
 * With a token we use Cesium World Terrain and ion's default world imagery.
 * Without one, every ion request would fail, so we fall back to the low-resolution
 * "NaturalEarthII" image that ships inside the cesium npm package, on a smooth ellipsoid
 * (no terrain). The fallback keeps the app usable in CI tests and for new teammates.
 */
function buildViewerOptions(): Viewer.ConstructorOptions {
  const widgets: Viewer.ConstructorOptions = {
    animation: false,
    timeline: false,
    geocoder: false, // the trek selector replaces place search
    baseLayerPicker: false, // the picker lists ion layers that need a token
    sceneModePicker: false,
    fullscreenButton: false,
    navigationInstructionsInitiallyVisible: false, // the "?" button still shows them
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
  };

  if (hasCesiumToken) {
    return { ...widgets, terrain: Terrain.fromWorldTerrain() };
  }

  const offlineImagery = TileMapServiceImageryProvider.fromUrl(
    buildModuleUrl('Assets/Textures/NaturalEarthII'),
  );
  return { ...widgets, baseLayer: ImageryLayer.fromProviderAsync(offlineImagery) };
}

/**
 * The 3D globe. Renders a notice on top when no Cesium ion token is configured.
 * `children` (for example RouteLayer) are rendered inside ViewerContext, so they can draw on the
 * globe with useViewer(). They get null until the Viewer exists.
 */
export function CesiumGlobe({ children }: { children?: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let created: Viewer | undefined;
    let removeHomeButtonHandler = () => {};
    try {
      created = new Viewer(container, buildViewerOptions());
      viewNepal(created);
      addMapDataCredits(created);
      removeHomeButtonHandler = makeHomeButtonShowNepal(created);
      // Share the Viewer with the children. Cesium lives outside React, so handing its object to
      // React after creating it is exactly what an effect is for.
      setViewer(created);
    } catch (error) {
      // Cesium has already drawn its own error panel (e.g. "WebGL is not supported")
      // inside the container, so the user sees what went wrong. We just log it.
      console.error('Could not create the Cesium viewer', error);
    }

    return () => {
      setViewer(null); // children must stop using the Viewer before it is destroyed
      removeHomeButtonHandler();
      created?.destroy();
    };
  }, []);

  return (
    <div className="globe">
      {!hasCesiumToken && (
        <p className="globe-notice" role="status">
          {t('globe.noToken')}
        </p>
      )}
      <div ref={containerRef} className="globe-canvas" data-testid="cesium-container" />
      <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>
    </div>
  );
}
