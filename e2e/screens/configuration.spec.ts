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

  // FOR-3 (F19.6): with a change, the save bar sticks to the bottom of the window; FOR-4: one line of protections.
  test('keeps the save bar in view while the formula has unsaved changes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/formula');
    const save = page.getByRole('button', { name: 'Guardar cambios' });
    await expect(page.getByRole('spinbutton', { name: 'S · Severidad' })).toBeEnabled();
    await expect(save).not.toBeInViewport();
    await page.getByRole('spinbutton', { name: 'S · Severidad' }).fill('0.3');
    await expect(page.locator('app-config-save-bar')).toHaveClass(/is-dirty/);
    await expect(save).toBeInViewport();
    // Still there at the end of the screen (it is its last block), past the version history.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(save).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Ver permisos y protecciones' })).toBeVisible();
    await page.getByRole('button', { name: 'Descartar cambios' }).click();
    await expect(page.locator('app-config-save-bar')).not.toHaveClass(/is-dirty/);
  });

  test('simulates a sensitivity profile together with its dead zone (D-091)', async ({ page }) => {
    await page.goto('/configuracion-agente');
    const broad = page.getByRole('radio', { name: /^Influencia amplia/ });
    await expect(broad).toBeEnabled();
    await broad.check();
    await expect(page.getByText('Zona muerta: ≤ 2')).toBeVisible();
    // Simulating saves nothing: the preview goes to POST /api/formula/simulate.
    const simulation = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/formula/simulate'),
    );
    await page.getByRole('button', { name: 'Simular' }).click();
    const body = (await simulation).postDataJSON() as { changes: Record<string, string> };
    expect(body.changes).toEqual({ sensitivity_profile: 'broad', dead_zone: '2' });
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });
});
