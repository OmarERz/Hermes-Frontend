import { asRole, expect, expectScreen, test } from '../support/fixtures';

// src/app/features/inventory/ (lane B · Inventario), against the backend's demo data (`make demo`): srv-pagos-01
// (CI-1, Server, 16 vCPU and 64 GB, OpenSSL 3.0.7 with the licence «Soporte OpenSSL»), vm-intranet-02 (CI-2,
// VirtualMachine, OpenSSL inactive) and srv-web-03 (CI-3, Server without owner, nginx and Redis). Read only, except
// the analyst's CPE mapping, which saves nginx with the CPE it already has (f5:nginx), and the CVE.org names of Redis,
// which the same test removes again, so the data stay the same.
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

  test('shows the software catalogue with categories, statuses and licences', async ({ page }) => {
    await page.goto('/software');
    const table = page.getByRole('region', {
      name: 'Catálogo de software; desplazamiento horizontal',
    });
    const openssl = table.getByRole('row').filter({ hasText: 'OpenSSL' });
    await expect(openssl).toContainText('Otro software');
    await expect(openssl).toContainText('Activa: 1');
    await expect(openssl).toContainText('Inactiva: 1');
    await expect(openssl).toContainText('Soporte OpenSSL');
    await expect(openssl).toContainText('cpe:2.3:a:openssl:openssl');
    await expect(table.getByRole('row').filter({ hasText: 'nginx' })).toContainText('Baja');
    await expect(page.getByRole('article', { name: 'Instalaciones por estado' })).toContainText(
      /Inactiva\s*1/,
    );
    await expect(page.getByRole('article', { name: 'Licencias' })).toContainText('Soporte OpenSSL');
    // Readers never get the mapping action (ACTION_ROLES.mapCpe).
    await expect(page.getByRole('button', { name: /CPE de/ })).toHaveCount(0);

    await page
      .getByRole('combobox', { name: 'Seleccionar visualización del catálogo' })
      .selectOption({ label: 'Vulnerabilidades por prioridad' });
    await expect(
      page.getByRole('group', { name: 'Conteo de vulnerabilidades únicas por prioridad' }),
    ).toContainText(/Críticas\s*[1-9]/);
    await expect(page.locator('app-grafico-dashboard svg')).toBeVisible();

    await page
      .getByRole('combobox', { name: 'Categoría' })
      .selectOption({ label: 'Otro software' });
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table).toContainText('OpenSSL');
  });
});

test.describe('pending inventory as reader', () => {
  asRole('reader');

  test('lists what the demo inventory lacks and opens the CI', async ({ page }) => {
    await page.goto('/pendientes-inventario');
    await expect(page.getByRole('region', { name: 'Pendientes por tipo' })).toContainText(
      /Sin responsable\s*1/,
    );
    const owners = page.getByRole('region', {
      name: 'Activos sin responsable; desplazamiento horizontal',
    });
    await expect(owners.getByRole('row').filter({ hasText: 'srv-web-03' })).toContainText('CI-3');
    // Every demo product has a CPE: no software list, and nothing to map for a reader anyway.
    await expect(page.getByRole('button', { name: 'Mapear CPE' })).toHaveCount(0);
    await owners.getByRole('link', { name: 'srv-web-03' }).click();
    await expect(page).toHaveURL(/\/activos\/CI-3$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('srv-web-03');
  });
});

test.describe('inventory as analyst', () => {
  asRole('analyst');

  test('maps a product to a CPE from its candidates', async ({ page }) => {
    await page.goto('/software');
    await page.getByRole('button', { name: 'Cambiar CPE de nginx' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mapear CPE · nginx' });
    await expect(dialog).toBeVisible();
    // Without an NVD key the throwaway stack answers with the pairs Hermes already holds.
    await dialog.getByRole('button', { name: /cpe:2\.3:a:f5:nginx/ }).click();
    await expect(dialog.getByRole('textbox', { name: 'CPE', exact: true })).toHaveValue(
      /^cpe:2\.3:a:f5:nginx:/,
    );
    await dialog.getByRole('button', { name: 'Guardar CPE' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('status').filter({ hasText: 'CPE guardado para nginx' }),
    ).toBeVisible();
  });

  // F15.9: the CNA names of a mapping, on Redis (no other test maps it). The test removes them at the end, so the
  // demo data stay the same.
  test('saves the CVE.org names of a mapping and removes them', async ({ page }) => {
    await page.goto('/software');
    const open = async () => {
      await page.getByRole('button', { name: 'Cambiar CPE de Redis' }).click();
      const dialog = page.getByRole('dialog', { name: 'Mapear CPE · Redis' });
      await expect(dialog).toBeVisible();
      return dialog;
    };
    const vendorOf = (dialog: Awaited<ReturnType<typeof open>>) =>
      dialog.getByRole('textbox', { name: 'Fabricante (CNA)' });
    const productOf = (dialog: Awaited<ReturnType<typeof open>>) =>
      dialog.getByRole('textbox', { name: 'Producto (CNA)' });

    let dialog = await open();
    await expect(dialog.getByRole('group', { name: /Nombres en CVE\.org \(CNA\)/ })).toContainText(
      'Sin ellos, Hermes no revisa esa fuente para este producto.',
    );
    await expect(vendorOf(dialog)).toHaveValue('');
    // One name alone is refused before any request.
    await vendorOf(dialog).fill('Redis');
    await dialog.getByRole('button', { name: 'Guardar CPE' }).click();
    await expect(dialog.getByText('Escribe también el producto')).toBeVisible();
    await expect(productOf(dialog)).toHaveAttribute('aria-invalid', 'true');
    await productOf(dialog).fill('Redis');
    await dialog.getByRole('button', { name: 'Guardar CPE' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('status').filter({ hasText: 'y los nombres de CVE.org Redis · Redis' }),
    ).toBeVisible();

    // The mapping keeps them: the dialog starts from them; emptying both removes them.
    dialog = await open();
    await expect(vendorOf(dialog)).toHaveValue('Redis');
    await expect(productOf(dialog)).toHaveValue('Redis');
    await vendorOf(dialog).fill('');
    await productOf(dialog).fill('');
    await dialog.getByRole('button', { name: 'Guardar CPE' }).click();
    await expect(dialog).toHaveCount(0);
    const notice = page.getByRole('status').filter({ hasText: 'CPE guardado para Redis' });
    await expect(notice).toBeVisible();
    await expect(notice).not.toContainText('CVE.org');

    dialog = await open();
    await expect(vendorOf(dialog)).toHaveValue('');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toHaveCount(0);
  });
});
