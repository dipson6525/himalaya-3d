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
 * M0 scope: prove that Cesium loads (workers, assets, token) locally and on GitHub Pages.
 * Nepal-centred camera, routes and stop markers come in M3 (issues #14 and #15).
 */
import {
  ImageryLayer,
  Terrain,
  TileMapServiceImageryProvider,
  Viewer,
  buildModuleUrl,
} from 'cesium';
import { useEffect, useRef } from 'react';
import { t } from '../i18n';
import { hasCesiumToken } from './cesiumSetup';

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
  };

  if (hasCesiumToken) {
    return { ...widgets, terrain: Terrain.fromWorldTerrain() };
  }

  const offlineImagery = TileMapServiceImageryProvider.fromUrl(
    buildModuleUrl('Assets/Textures/NaturalEarthII'),
  );
  return { ...widgets, baseLayer: ImageryLayer.fromProviderAsync(offlineImagery) };
}

/** The 3D globe. Renders a notice on top when no Cesium ion token is configured. */
export function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let viewer: Viewer | undefined;
    try {
      viewer = new Viewer(container, buildViewerOptions());
    } catch (error) {
      // Cesium has already drawn its own error panel (e.g. "WebGL is not supported")
      // inside the container, so the user sees what went wrong. We just log it.
      console.error('Could not create the Cesium viewer', error);
    }

    return () => {
      viewer?.destroy();
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
    </div>
  );
}
