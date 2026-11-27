import { asRole, expect, expectScreen, settle, test } from '../support/fixtures';
import { email } from '../support/roles';

// src/app/features/admin/ (lane F2 · Corridas y administración), against the backend's demo data and the emulator
// users of the suite (reader, analyst and admin @hermes.test). Owned by that lane. No test saves a role: the change
// revokes that user's sessions, which the other specs use in parallel; the dialog is opened and cancelled.
test.describe('admin as admin', () => {
  asRole('admin');

  test('Usuarios y roles', ({ page }) => expectScreen(page, '/usuarios', 'Usuarios y roles'));
  test('Auditoría', ({ page }) => expectScreen(page, '/auditoria', 'Auditoría'));
  test('Cola de errores', ({ page }) => expectScreen(page, '/cola-errores', 'Cola de errores'));

  test('lists the accounts with their roles and confirms a role change before saving', async ({
    page,
  }) => {
    await page.goto('/usuarios');
    const table = page.getByRole('region', { name: 'Cuentas; desplazamiento horizontal' });
    const own = table.getByRole('row').filter({ hasText: email('admin') });
    await expect(own).toContainText('Tú');
    await expect(own).toContainText('Administrador');
    await expect(own).toContainText('Tu propio rol no se puede cambiar.');
    await expect(own.getByRole('combobox')).toHaveCount(0);

    const reader = table.getByRole('row').filter({ hasText: email('reader') });
    await expect(reader).toContainText('Lector');
    const select = reader.getByRole('combobox');
    await select.selectOption('analyst');
    const dialog = page.getByRole('dialog', { name: 'Confirmar cambio de rol' });
    await expect(dialog).toContainText('Anterior Lector');
    await expect(dialog).toContainText('Nuevo Analista');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toHaveCount(0);
    // Nothing was saved: the select is back on the stored role.
    await expect(select).toHaveValue('reader');
    await settle(page);
  });

  test('shows the audit trail and filters it by actor', async ({ page }) => {
    await page.goto('/auditoria');
    const panel = page.getByRole('region', { name: 'Registro de auditoría', exact: true });
    // The emulator users signed in, so the trail has at least their accounts (or it says it is empty).
    await expect(
      panel
        .getByRole('region', { name: 'Registro de auditoría; desplazamiento horizontal' })
        .or(panel.getByText('Aún no hay registros de auditoría.')),
    ).toBeVisible();
    await page
      .getByLabel('Actor (correo, nombre o «sistema» para las automáticas)')
      .fill('nadie-x');
    await page.keyboard.press('Enter');
    await expect(panel.getByText('No hay registros con estos filtros.')).toBeVisible();
    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    await expect(page.getByRole('button', { name: 'Quitar filtros' })).toHaveCount(0);
  });

  test('shows the demo iTop writes in the error queue without a retry', async ({ page }) => {
    await page.goto('/cola-errores');
    const table = page.getByRole('region', { name: 'Cola de errores; desplazamiento horizontal' });
    // The demo saves its iTop operations as failed, never to be sent.
    const parked = table
      .getByRole('row')
      .filter({ hasText: 'demo data: never sent to iTop' })
      .first();
    await expect(parked).toContainText('Escritura en iTop');
    await expect(parked).toContainText('Agotó sus reintentos');
    await expect(parked.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);

    await page.getByRole('combobox', { name: 'Origen del error' }).selectOption('llm_validation');
    await expect(
      table.getByRole('row').nth(1).or(page.getByText('No hay errores de este origen.')),
    ).toBeVisible();
    await expect(table.getByText('demo data: never sent to iTop')).toHaveCount(0);
  });
});
