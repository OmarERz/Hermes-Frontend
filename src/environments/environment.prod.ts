import type { AppConfig } from '../app/core/config/app-config';

/**
 * Production defaults (ng build): the API on the same origin, behind the reverse proxy, and no emulator.
 * The Firebase web config of the real project comes from runtime-config.json served next to index.html
 * (example: src/environments/runtime-config.example.json), so the build never needs a local file.
 */
export const environment: AppConfig = {
  production: true,
  apiBaseUrl: '',
  firebase: null,
  authEmulatorUrl: null,
};
