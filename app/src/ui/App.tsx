/**
 * App.tsx — top-level page layout: header, 3D globe, side panel and safety disclaimer.
 * Owner: Dipson Gurung (UI). Related FR: all (this is where features are mounted).
 *
 * The medical disclaimer lives in the footer of the layout so it is visible on every
 * screen, as required by our safety rule. Feature panels (trek selector, itinerary,
 * elevation profile, layers) will be added to the side panel in later milestones.
 */
import { CesiumGlobe } from '../engine/CesiumGlobe';
import { t } from '../i18n';

/** The whole application page. */
export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('app.title')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
      </header>

      <main className="app-main">
        <section className="globe-area" aria-label={t('globe.label')}>
          <CesiumGlobe />
        </section>
        <aside className="side-panel">
          <p>{t('panel.comingSoon')}</p>
        </aside>
      </main>

      <footer className="disclaimer" role="note">
        {t('disclaimer.medical')}
      </footer>
    </div>
  );
}
