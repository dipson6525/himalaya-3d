/**
 * ViewerContext.ts — shares the one Cesium Viewer with the components that draw on the globe.
 * Owner: Sparsh Gorkhali. Related FR: FR2 onwards; ADR-018 ("ViewerContext added in #15").
 *
 * CesiumGlobe creates the Viewer and provides it; components inside the globe (RouteLayer now,
 * earthquake layer and flythrough later) call useViewer(). The value is null until the Viewer
 * exists (and if WebGL is missing), so every user must handle null. The Viewer object itself
 * never changes after start-up, so sharing it does not cause extra re-renders.
 */
import type { Viewer } from 'cesium';
import { createContext, useContext } from 'react';

export const ViewerContext = createContext<Viewer | null>(null);

/** The Cesium Viewer, or null while it is being created (or if it could not be created). */
export function useViewer(): Viewer | null {
  return useContext(ViewerContext);
}
