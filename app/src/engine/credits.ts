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
 *
 * Cesium updates the credit area only when it draws a frame. In request-render mode, code that
 * adds or removes a credit while nothing else changes must call viewer.scene.requestRender()
 * (the live layers in #25 and #26 will). At start-up the first frame is drawn anyway.
 */
import { Credit, type Viewer } from 'cesium';
import { t } from '../i18n';

/**
 * OpenStreetMap's attribution (required by the ODbL licence) as a link to its copyright page.
 * The text comes from the i18n files ("credits.osm"); it is English in both for now. See the
 * OSMF Attribution Guidelines (https://osmfoundation.org/wiki/Licence/Attribution_Guidelines).
 * TODO(team): verify whether a Nepali wording is allowed (listed in docs/i18n-review.md).
 */
export function osmCreditHtml(): string {
  return (
    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">' +
    `${t('credits.osm')}</a>`
  );
}

/** Add the credits that are always on. Live layers add theirs later (USGS #25, Open-Meteo #26). */
export function addMapDataCredits(viewer: Viewer): void {
  viewer.creditDisplay.addStaticCredit(new Credit(osmCreditHtml(), true));
}
