import { expect, test } from '@playwright/test';
import { email, PASSWORD, ROLE_LABELS, ROLES, sessionFile } from './support/roles';

// Signs in through the login screen with each emulator user and saves the session for the other tests.
for (const role of ROLES) {
  test(`signs in as ${role} with the login screen`, async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await page.getByLabel('Correo').fill(email(role));
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/inicio$/);
    // The effective role comes from GET /api/me (the profile menu shows it).
    await expect(page.locator('.sidebar-profile .profile-trigger')).toContainText(
      ROLE_LABELS[role],
    );
    await page.context().storageState({ path: sessionFile(role), indexedDB: true });
  });
}
