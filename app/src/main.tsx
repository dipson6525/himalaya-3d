/**
 * main.tsx — entry point of the React app.
 * Owner: Dipson Gurung (UI). Related FR: all.
 *
 * Order matters: cesiumSetup must run before any Cesium Viewer is created, because it
 * tells Cesium where its workers/assets live and sets the ion access token.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './engine/cesiumSetup';
import { App } from './ui/App';
import './ui/styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html is missing <div id="root">');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
