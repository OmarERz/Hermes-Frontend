import type { Browser, Page } from '@playwright/test';
import { asRole, expect, settle, test } from '../support/fixtures';
import { EMULATOR_PROJECT, ROLE_LABELS } from '../support/roles';

// Accounts created and switched off from the Users screen (F17.14, backend F18.8, D-105), end to end against the
// isolated stack: the admin creates a throwaway account (only ever in this run's Auth emulator), Firebase "e-mails" the
// link to choose a password (the emulator keeps it), the person chooses one and signs in with the role the admin gave,
// and the admin switches the account off and back on. A backend without the routes (405) skips the test.
test.describe('accounts from the app as admin', () => {
  asRole('admin');

  test('creates an account that chooses its password from the e-mail, then switches it off and on', async ({
    page,
    browser,
  }) => {
    const address = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@hermes.test`;
    await page.goto('/usuarios');
    await page.getByRole('button', { name: 'Agregar usuario' }).click();
    const form = page.getByRole('dialog', { name: 'Agregar usuario' });
    await form.getByLabel('Correo').fill(address);
    await form.getByLabel('Rol').selectOption('analyst');
    const created = page.waitForResponse(
      (r) => r.url().endsWith('/api/admin/users') && r.request().method() === 'POST',
    );
    await form.getByRole('button', { name: 'Crear usuario' }).click();
    const response = await created;
    test.skip(
      response.status() === 405,
      'the backend of this run has no POST /api/admin/users yet (backend F18.8 not in develop)',
    );
    expect(response.status()).toBe(201);
    const notice = page.locator('.admin-notice');
    await expect(notice).toHaveText(`Se envió un correo a ${address} para crear su contraseña.`);
    const row = page
      .getByRole('region', { name: 'Cuentas; desplazamiento horizontal' })
      .getByRole('row')
      .filter({ hasText: address });
    await expect(row).toContainText(ROLE_LABELS.analyst);
    await expect(row).toContainText('Nunca');
    await expect(
      row.getByRole('button', { name: `Reenviar correo a ${address} para crear su contraseña` }),
    ).toBeVisible();

    // The person follows the link of the e-mail (kept by the emulator) and chooses a password.
    const password = `Pw-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    await choosePassword(address, password);
    const person = await signIn(browser, address, password);
    await expect(person.locator('.sidebar-profile .profile-trigger')).toContainText(
      ROLE_LABELS.analyst,
    );
    await person.context().close();

    await row.getByRole('button', { name: `Desactivar la cuenta de ${address}` }).click();
    const off = page.getByRole('dialog', { name: 'Desactivar cuenta' });
    await expect(off).toContainText('Activa → Desactivada');
    await off.getByRole('button', { name: 'Desactivar', exact: true }).click();
    await expect(notice).toHaveText(
      `La cuenta de ${address} quedó desactivada y se cerraron sus sesiones.`,
    );
    await expect(row).toContainText('Desactivada');
    await expect(row.getByRole('button', { name: /Reenviar correo/ })).toHaveCount(0);

    await row.getByRole('button', { name: `Reactivar la cuenta de ${address}` }).click();
    await page
      .getByRole('dialog', { name: 'Reactivar cuenta' })
      .getByRole('button', { name: 'Reactivar', exact: true })
      .click();
    await expect(notice).toHaveText(
      `La cuenta de ${address} está activa de nuevo: tendrá que iniciar sesión.`,
    );
    await expect(row).toContainText('Activa');
    await settle(page);
  });

  test('never offers to switch the own account off', async ({ page }) => {
    await page.goto('/usuarios');
    const own = page
      .getByRole('region', { name: 'Cuentas; desplazamiento horizontal' })
      .getByRole('row')
      .filter({ hasText: 'Tú' });
    await expect(own).toContainText('Es tu cuenta.');
    await expect(own.getByRole('button', { name: /Desactivar|Reactivar/ })).toHaveCount(0);
    await settle(page);
  });
});

function emulator(): string {
  const url = process.env['E2E_AUTH_EMULATOR_URL'];
  if (!url) throw new Error('E2E_AUTH_EMULATOR_URL is not set: run the suite with `npm run e2e`');
  return url;
}

/** Reads the password-reset code the emulator kept for `address` and sets the password with it. */
async function choosePassword(address: string, password: string): Promise<void> {
  const mailbox = await fetch(`${emulator()}/emulator/v1/projects/${EMULATOR_PROJECT}/oobCodes`);
  expect(mailbox.ok).toBe(true);
  const { oobCodes } = (await mailbox.json()) as {
    oobCodes: { email: string; oobCode: string; requestType: string }[];
  };
  const code = oobCodes.find((c) => c.email === address && c.requestType === 'PASSWORD_RESET');
  expect(code, `the emulator kept no password e-mail for ${address}`).toBeDefined();
  const reset = await fetch(
    `${emulator()}/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ oobCode: code!.oobCode, newPassword: password }),
    },
  );
  expect(reset.ok).toBe(true);
}

/** Signs in through the login screen in a fresh browser context (no saved session). */
async function signIn(browser: Browser, address: string, password: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: process.env['E2E_BASE_URL'] });
  const person = await context.newPage();
  await person.goto('/login');
  await person.getByLabel('Correo').fill(address);
  await person.getByLabel('Contraseña', { exact: true }).fill(password);
  await person.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(person).toHaveURL(/\/inicio$/);
  return person;
}
