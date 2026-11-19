/**
 * vite-env.d.ts — TypeScript types for Vite's import.meta.env.
 * Owner: Sparsh Gorkhali. Lists the environment variables our code is allowed to read.
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cesium ion access token. Comes from .env.local (dev) or the CESIUM_ION_TOKEN secret (CI). */
  readonly VITE_CESIUM_ION_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
