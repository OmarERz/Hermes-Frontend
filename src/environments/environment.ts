import type { AppConfig } from '../app/core/config/app-config';

/**
 * Development defaults (ng serve, unit tests): the local backend stack of the backend repo (`make up`) and its
 * Firebase Auth emulator, project `demo-hermes`. A clean clone works with them; to use the real Firebase project
 * without touching this file, copy src/environments/runtime-config.example.json to public/runtime-config.json.
 */
export const environment: AppConfig = {
  production: false,
  apiBaseUrl: 'http://127.0.0.1:8000',
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-hermes.firebaseapp.com',
    projectId: 'demo-hermes',
    appId: 'demo-hermes-web',
  },
  authEmulatorUrl: 'http://127.0.0.1:9099',
};
