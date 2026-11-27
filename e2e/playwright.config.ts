import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';
import { outputRoot } from './support/roles';

/**
 * Browser suite (e2e/run.sh builds and serves the front container next to an isolated backend stack, then runs this
 * inside the pinned Playwright image). E2E_BASE_URL is the served front; E2E_AUTH_EMULATOR_URL the Firebase Auth
 * emulator of that stack. Outputs (report, traces, sessions) go to this run's own folder under e2e/test-output/
 * (E2E_OUTPUT_DIR, ignored by git), so two runs never share them.
 */
const baseURL = process.env['E2E_BASE_URL'];
if (!baseURL)
  throw new Error('E2E_BASE_URL is not set: run the suite with `npm run e2e` (e2e/run.sh)');

export default defineConfig({
  testDir: '.',
  outputDir: join(outputRoot(), 'results'),
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 4,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: join(outputRoot(), 'report'), open: 'never' }]],
  use: {
    baseURL,
    locale: 'es-MX',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Signs in once per role through the login screen and keeps each session for the other tests.
    { name: 'login', testMatch: 'login.setup.ts' },
    {
      name: 'chromium',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['login'],
    },
  ],
});
