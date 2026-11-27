import { EMULATOR_PROJECT, PASSWORD, ROLES, email, type Role } from './support/roles';

/**
 * Creates (or reuses) one Firebase Auth emulator user per role with its `role` custom claim, as the backend's
 * `make emulator-token` does (core.devtools.emulator): the emulator accepts any API key and "Bearer owner" as the
 * project owner. Only ever talks to the emulator of the isolated stack.
 */
export default async function globalSetup(): Promise<void> {
  const emulator = process.env['E2E_AUTH_EMULATOR_URL'];
  if (!emulator)
    throw new Error('E2E_AUTH_EMULATOR_URL is not set: run the suite with `npm run e2e`');
  for (const role of ROLES) await ensureUser(emulator, role);
}

async function call(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function ensureUser(emulator: string, role: Role): Promise<void> {
  const base = `${emulator}/identitytoolkit.googleapis.com/v1`;
  const credentials = { email: email(role), password: PASSWORD, returnSecureToken: true };
  let response = await call(`${base}/accounts:signUp?key=fake-api-key`, credentials);
  if (!response.ok) {
    response = await call(`${base}/accounts:signInWithPassword?key=fake-api-key`, credentials);
  }
  if (!response.ok) throw new Error(`emulator user ${role}: HTTP ${response.status}`);
  const { localId } = (await response.json()) as { localId: string };
  const claims = await call(
    `${base}/projects/${EMULATOR_PROJECT}/accounts:update`,
    { localId, customAttributes: JSON.stringify({ role }) },
    { authorization: 'Bearer owner' },
  );
  if (!claims.ok) throw new Error(`emulator claims of ${role}: HTTP ${claims.status}`);
}
