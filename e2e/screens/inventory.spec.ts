import { asRole, expect, expectScreen, test } from '../support/fixtures';

// src/app/features/inventory/ (lane B · Inventario), against the backend's demo data (`make demo`): srv-pagos-01
// (CI-1, Server, 16 vCPU and 64 GB, OpenSSL 3.0.7 with the licence «Soporte OpenSSL»), vm-intranet-02 (CI-2,
// VirtualMachine, OpenSSL inactive) and srv-web-03 (CI-3, Server without owner, nginx and Redis). Read only.
test.describe('inventory as reader', () => {
  asRole('reader');

  test('Activos', ({ page }) => expectScreen(page, '/activos', 'Activos'));
  test('Software', ({ page }) => expectScreen(page, '/software', 'Software'));
  test('Pendientes de inventario', ({ page }) =>
    expectScreen(page, '/pendientes-inventario', 'Pendientes de inventario'));

  test('lists the demo CIs with their iTop class, hardware and owner', async ({ page }) => {
    await page.goto('/activos');
    const table = page.getByRole('region', {
      name: 'Inventario de activos; desplazamiento horizontal',
    });
    const payments = table.getByRole('row').filter({ hasText: 'srv-pagos-01' });
    await expect(payments).toContainText('CI-1');
    await expect(payments).toContainText('Servidor');
    await expect(payments).toContainText('16 vCPU');
    await expect(payments).toContainText('64 GB');
    await expect(payments).toContainText('Dueña de Pagos');
    await expect(payments).toContainText('Infraestructura Linux');
    await expect(table.getByRole('row').filter({ hasText: 'srv-web-03' })).toContainText(
      'Sin responsable',
    );
    await expect(page.getByRole('region', { name: 'Resumen del inventario' })).toContainText(
      /Total de activos\s*3/,
    );

    await page
      .getByRole('combobox', { name: 'Clase de iTop' })
      .selectOption({ label: 'Máquina virtual' });
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table).toContainText('vm-intranet-02');
    await expect(table).toContainText('4 vCPU');
  });

  test('opens a CI with its iTop data, installed software and vulnerabilities', async ({
    page,
  }) => {
    await page.goto('/activos');
    await page.getByRole('link', { name: 'srv-pagos-01' }).click();
    await expect(page).toHaveURL(/\/activos\/CI-1$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('srv-pagos-01');
    const facts = page.getByRole('region', { name: 'Datos de iTop' });
    await expect(facts).toContainText(/CPU\s*16 vCPU/);
    await expect(facts).toContainText(/RAM\s*64 GB/);
    await expect(facts).toContainText(/Clase de iTop\s*Servidor · Server/);
    await expect(facts).toContainText(/Criticidad\s*Alta/);

    const software = page.getByRole('region', {
      name: 'Software instalado; desplazamiento horizontal',
    });
    const openssl = software.getByRole('row').filter({ hasText: 'OpenSSL' });
    await expect(openssl).toContainText('3.0.7');
    await expect(openssl).toContainText('Otro software');
    await expect(openssl).toContainText('Activa');
    await expect(openssl).toContainText('Soporte OpenSSL');
    await expect(openssl).toContainText('cpe:2.3:a:openssl:openssl');

    const findings = page.getByRole('region', {
      name: 'Vulnerabilidades del activo; desplazamiento horizontal',
    });
    await expect(findings.getByRole('link', { name: 'CVE-2026-10001' })).toBeVisible();
  });

  test('shows an inactive installation as iTop has it', async ({ page }) => {
    await page.goto('/activos/CI-2');
    const software = page.getByRole('region', {
      name: 'Software instalado; desplazamiento horizontal',
    });
    await expect(software.getByRole('row').filter({ hasText: 'OpenSSL' })).toContainText(
      'Inactiva',
    );
    await expect(page.getByRole('link', { name: 'Volver a activos' })).toBeVisible();
  });
});
