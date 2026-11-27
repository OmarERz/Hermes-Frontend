import { asRole, expect, expectScreen, test } from '../support/fixtures';

// src/app/features/company/ (lane F1 · Fuentes y empresa). Owned by that lane: extend it as the screens grow (data
// shown, empty and error states, editing as admin).
test.describe('company as reader', () => {
  asRole('reader');

  test('Empresa', ({ page }) => expectScreen(page, '/empresa', 'Empresa'));

  test('shows the profile and the peers without the edit actions', async ({ page }) => {
    await page.goto('/empresa');
    await expect(page.getByRole('heading', { name: 'Perfil de la empresa' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Empresas pares' })).toBeVisible();
    // Editing the profile and the peers is for admins.
    await expect(page.getByRole('button', { name: 'Agregar empresa' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar perfil' })).toHaveCount(0);
  });
});

test.describe('company as admin', () => {
  asRole('admin');

  test('offers to add a peer company', async ({ page }) => {
    await page.goto('/empresa');
    await expect(page.getByRole('button', { name: 'Agregar empresa' })).toBeVisible();
  });
});
