import { join } from 'node:path';

export type Role = 'reader' | 'analyst' | 'admin';

export const ROLES: readonly Role[] = ['reader', 'analyst', 'admin'];

/** Firebase project of the backend's Auth emulator (compose.yaml) and of the e2e build (src/environments). */
export const EMULATOR_PROJECT = 'demo-hermes';

/** Fixed password of the throwaway emulator users (the same as the backend's core.devtools.emulator). */
export const PASSWORD = 'emulator-test-password';

/** Spanish name of each role, as the profile menu shows it (src/app/core/auth/roles.ts). */
export const ROLE_LABELS: Record<Role, string> = {
  reader: 'Lector',
  analyst: 'Analista',
  admin: 'Administrador',
};

export function email(role: Role): string {
  return `${role}@hermes.test`;
}

/** This run's output folder (report, traces, sessions), set by e2e/run.sh: two runs never share one. */
export function outputRoot(): string {
  const dir = process.env['E2E_OUTPUT_DIR'];
  if (!dir)
    throw new Error('E2E_OUTPUT_DIR is not set: run the suite with `npm run e2e` (e2e/run.sh)');
  return dir;
}

/** Saved session (cookies, local storage and the IndexedDB where Firebase keeps it) of each role. */
export function sessionFile(role: Role): string {
  return join(outputRoot(), 'sessions', `${role}.json`);
}
