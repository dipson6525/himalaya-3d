/**
 * credits.ts — data credits that must stay visible on the map.
 * Owner: Sparsh Gorkhali (engine); credit texts agreed with Dipson. Related: NFR5, ADR-018.
 *
 * Cesium shows its own credits (the Cesium ion logo and a "Data attribution" link) in the
 * credit area at the bottom of the globe. We add ours to the same area with
 * creditDisplay.addStaticCredit, so they share Cesium's layout and never collide with our panels.
 *
 * `new Credit(html, true)`: the `true` (showOnScreen) puts the credit on the map itself.
 * Without it Cesium would only list it inside the "Data attribution" pop-up.
 */
import { Credit, type Viewer } from 'cesium';

/**
 * OpenStreetMap's required attribution (ODbL). Every trail line comes from OSM, so it is shown
 * all the time. Attribution text is kept in English, as OSM asks, in both languages.
 */
export const OSM_CREDIT_HTML =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">' +
  '© OpenStreetMap contributors</a>';

/** Add the credits that are always on. Live layers add theirs later (USGS #25, Open-Meteo #26). */
export function addMapDataCredits(viewer: Viewer): void {
  viewer.creditDisplay.addStaticCredit(new Credit(OSM_CREDIT_HTML, true));
}
