import { asRole, expect, expectScreen, test } from '../support/fixtures';

// src/app/features/configuration/ (lane E · Juez y fórmula), against the backend's factory configuration. Owned by
// that lane: extend it as the screens grow. Nothing is saved here: the suite runs in parallel on one stack.
test.describe('configuration as reader', () => {
  asRole('reader');

  test('Configuración del juez', ({ page }) =>
    expectScreen(page, '/configuracion-agente', 'Configuración del juez'));
  test('Fórmula', ({ page }) => expectScreen(page, '/formula', 'Fórmula'));
  test('Parámetros', ({ page }) => expectScreen(page, '/parametros', 'Parámetros'));
  test('Calibración', ({ page }) => expectScreen(page, '/calibracion', 'Calibración'));

  test('shows the formula weights read-only', async ({ page }) => {
    await page.goto('/formula');
    const severity = page.getByRole('spinbutton', { name: 'S · Severidad' });
    await expect(severity).toHaveValue(/^0\.\d+$/);
    await expect(severity).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
  });

  test('shows the judge profile read-only', async ({ page }) => {
    await page.goto('/configuracion-agente');
    await expect(page.getByRole('radio', { name: /^Normal/ })).toBeDisabled();
    await expect(page.getByRole('main')).toContainText('Puedes ver la configuración');
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
  });
});

test.describe('configuration as analyst', () => {
  asRole('analyst');

  test('cannot edit the formula, which is for admins', async ({ page }) => {
    await page.goto('/formula');
    await expect(page.getByRole('spinbutton', { name: 'S · Severidad' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
  });
});

test.describe('configuration as admin', () => {
  asRole('admin');

  test('can edit the formula and the judge profile', async ({ page }) => {
    await page.goto('/formula');
    await expect(page.getByRole('spinbutton', { name: 'S · Severidad' })).toBeEnabled();
    // Saving needs a change and a simulation first.
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();

    await page.goto('/configuracion-agente');
    await expect(page.getByRole('radio', { name: /^Normal/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  });
});
