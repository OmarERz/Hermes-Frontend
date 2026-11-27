import { asRole, expect, expectScreen, test } from '../support/fixtures';

// src/app/features/setup/ (F17.12 · Asistente de configuración), an admin screen, against the demo data of the
// stack. Nothing is marked, saved or launched here: the suite runs in parallel on one stack, and «Probar de nuevo»
// would call the configured services.
const STEPS = [
  'Conexiones',
  'Perfil de la empresa',
  'Empresas pares',
  'Fuentes',
  'Revisión del inventario',
  'Sensibilidad y fórmula',
  'Primer escaneo',
];

test.describe('setup as admin', () => {
  asRole('admin');

  test('Asistente de configuración', ({ page }) =>
    expectScreen(page, '/asistente', 'Asistente de configuración'));

  test('lists the seven steps of the API and shows each one', async ({ page }) => {
    await page.goto('/asistente');
    const stepper = page.getByRole('navigation', { name: 'Pasos del asistente' });
    await expect(stepper.locator('.step-link strong')).toHaveText(STEPS);
    await expect(page.getByRole('heading', { name: /^Paso \d · / })).toBeVisible();

    await stepper.getByRole('button', { name: /^Conexiones/ }).click();
    await expect(page.getByRole('heading', { name: 'Paso 1 · Conexiones' })).toBeVisible();
    await expect(page.locator('.connection-list li[data-name="itop"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Probar de nuevo' })).toBeEnabled();
    // Keys are never typed into the front.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('.setup-footnote')).toContainText('Ninguna llave se captura');

    await stepper.getByRole('button', { name: /^Fuentes/ }).click();
    await expect(page.getByRole('heading', { name: 'Paso 4 · Fuentes' })).toBeVisible();
    await expect(page.locator('.step-locked')).toContainText('Siempre activas');

    await stepper.getByRole('button', { name: /^Revisión del inventario/ }).click();
    await expect(page.locator('.pending-list li')).toHaveCount(6);

    await stepper.getByRole('button', { name: /^Sensibilidad y fórmula/ }).click();
    await expect(page.locator('.profile-value')).not.toHaveText('—');
    await expect(
      page.getByRole('link', { name: 'Elegir el perfil en Configuración del juez' }),
    ).toBeVisible();

    await stepper.getByRole('button', { name: /^Primer escaneo/ }).click();
    // Visible, not pressed (another test may have a scan running).
    await expect(page.getByRole('button', { name: /^Lanzar/ })).toBeVisible();
  });

  test('moves between the steps with Anterior and Siguiente', async ({ page }) => {
    await page.goto('/asistente');
    const stepper = page.getByRole('navigation', { name: 'Pasos del asistente' });
    await stepper.getByRole('button', { name: /^Conexiones/ }).click();
    await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(
      page.getByRole('heading', { name: 'Paso 2 · Perfil de la empresa' }),
    ).toBeVisible();
    await expect(stepper.getByRole('button', { name: /^Perfil de la empresa/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });
});

for (const role of ['reader', 'analyst'] as const) {
  test.describe(`setup as ${role}`, () => {
    asRole(role);

    test('sends the wizard to the forbidden screen', async ({ page }) => {
      await page.goto('/asistente');
      await expect(page).toHaveURL(/\/sin-permiso$/);
    });
  });
}
