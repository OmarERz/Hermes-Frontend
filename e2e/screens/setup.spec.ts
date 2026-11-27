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
    await expect(page.locator('.pending-list li[data-kind="software_without_cpe"]')).toBeVisible();

    // The profile is chosen here, with the simulation first (nothing is saved in this suite).
    await stepper.getByRole('button', { name: /^Sensibilidad y fórmula/ }).click();
    await expect(page.locator('.profile-value')).not.toHaveText('—');
    const profiles = page.locator('.setup-profiles');
    await expect(profiles.getByRole('radio', { name: /^Normal/ })).toBeEnabled();
    await expect(profiles.getByText('Zona muerta: ≤ 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();

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

test.describe('setup reminder as admin', () => {
  asRole('admin');

  // The stack has no external keys, so the connections step stays pending and the reminder shows.
  test('the start screen points to the wizard while steps are pending', async ({ page }) => {
    await page.goto('/inicio');
    const reminder = page.getByRole('complementary', { name: 'Configuración inicial' });
    await expect(reminder).toContainText('pasos pendientes en el asistente');
    await reminder.getByRole('link', { name: 'Abrir el asistente' }).click();
    await expect(page).toHaveURL(/\/asistente$/);
  });
});

for (const role of ['reader', 'analyst'] as const) {
  test.describe(`setup as ${role}`, () => {
    asRole(role);

    test('sends the wizard to the forbidden screen', async ({ page }) => {
      await page.goto('/asistente');
      await expect(page).toHaveURL(/\/sin-permiso$/);
    });

    test('shows no setup reminder on the start screen', async ({ page }) => {
      await page.goto('/inicio');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('complementary', { name: 'Configuración inicial' })).toHaveCount(
        0,
      );
    });
  });
}
