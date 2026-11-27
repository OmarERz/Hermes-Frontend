import { asRole, expect, expectScreen, settle, test } from '../support/fixtures';

// src/app/features/vulnerabilities/ (lane C · Vulnerabilidades y tickets), against the backend's demo data
// (`make demo`: CVE-2026-10001 in OpenSSL, critical, and CVE-2026-10002 in nginx, low, with the tickets DEMO-1 and
// DEMO-2). Owned by that lane: extend it as the screens grow (filters, empty and error states, actions by role).
test.describe('vulnerabilities as reader', () => {
  asRole('reader');

  test('Vulnerabilidades', ({ page }) =>
    expectScreen(page, '/vulnerabilidades', 'Vulnerabilidades'));
  test('Comparación', ({ page }) => expectScreen(page, '/comparacion', 'Comparación'));
  test('Tickets y alertas', ({ page }) => expectScreen(page, '/tickets', 'Tickets y alertas'));

  test('lists the demo vulnerabilities and opens one without the STIX export', async ({ page }) => {
    await page.goto('/vulnerabilidades');
    const table = page.getByRole('region', { name: 'Vulnerabilidades; desplazamiento horizontal' });
    const critical = table.getByRole('row').filter({ hasText: 'CVE-2026-10001' });
    await expect(critical).toContainText('OpenSSL');
    await expect(critical).toContainText('Crítica');
    await expect(table.getByRole('row').filter({ hasText: 'CVE-2026-10002' })).toContainText(
      'nginx',
    );

    await critical.getByRole('link', { name: 'CVE-2026-10001' }).click();
    await expect(page).toHaveURL(/\/vulnerabilidades\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('CVE-2026-10001');
    await expect(page.getByRole('region', { name: 'Resumen' })).toContainText('Puntaje final');
    await expect(page.getByRole('link', { name: 'Volver a vulnerabilidades' })).toBeVisible();
    // The export is for analysts and admins (ACTION_ROLES.exportStix).
    await expect(page.getByRole('link', { name: 'Exportar STIX' })).toHaveCount(0);
  });

  test('keeps the less used filters behind «Más filtros» and counts the ones in use', async ({
    page,
  }) => {
    await page.goto('/vulnerabilidades');
    const filters = page.getByRole('region', { name: 'Filtros', exact: true });
    // Visible labels above the main filters (G8), the rest folded (VUL-1).
    await expect(filters.getByText('Nivel', { exact: true })).toBeVisible();
    await expect(filters.getByLabel('Custodio (texto exacto)')).toBeHidden();
    const more = filters.getByRole('button', { name: 'Más filtros' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    await more.click();
    const custodian = filters.getByLabel('Custodio (texto exacto)');
    await expect(custodian).toBeVisible();
    await custodian.fill('Plataforma');
    await custodian.blur();
    await expect(filters.getByRole('button', { name: 'Quitar filtros' })).toBeVisible();

    await filters.getByRole('button', { name: 'Menos filtros' }).click();
    await expect(custodian).toBeHidden();
    await expect(filters.getByRole('button', { name: 'Más filtros (1 activo)' })).toBeVisible();
  });

  test('draws the score charts and their tooltips within the CSP', async ({ page }) => {
    await page.goto('/vulnerabilidades');
    await page.getByRole('link', { name: 'CVE-2026-10001' }).click();
    await page.getByRole('button', { name: 'Historial y cascada' }).first().click();
    const charts = page.locator('app-grafico-dashboard');
    await expect(charts).toHaveCount(2);
    for (const chart of await charts.all()) {
      await expect(chart.locator('svg')).toBeVisible();
      // ECharts draws its tooltip as HTML next to the SVG (style set through the CSSOM, content as markup).
      await chart.hover();
      await expect(chart.locator('div[style*="z-index: 9999999"]')).toBeVisible();
    }
    await settle(page);
  });

  test('shows the demo tickets and the threat alerts', async ({ page }) => {
    await page.goto('/tickets');
    const tickets = page.getByRole('region', { name: 'Tickets; desplazamiento horizontal' });
    const first = tickets.getByRole('row').filter({ hasText: 'DEMO-1' });
    await expect(first).toContainText('CVE-2026-10001');
    await expect(first).toContainText('Abierto');
    await expect(tickets.getByRole('row').filter({ hasText: 'DEMO-2' })).toContainText(
      'CVE-2026-10002',
    );
    const alerts = page.getByRole('region', { name: 'Alertas; desplazamiento horizontal' });
    // Header row plus at least one alert of the demo news.
    await expect(alerts.getByRole('row').nth(1)).toBeVisible();
  });

  test('compares raw cvss with the final urgency', async ({ page }) => {
    await page.goto('/comparacion');
    const reclassified = page
      .getByRole('region', { name: 'Indicadores' })
      .locator('app-kpi-card')
      .filter({ hasText: 'Reclasificados' });
    await expect(reclassified.locator('.kpi-value')).toHaveText(/^\d+(\.\d+)? %$/);
    const matrix = page.getByRole('region', { name: 'Matriz de reclasificación' });
    await expect(matrix.getByRole('rowheader', { name: 'Crítica' })).toBeVisible();
  });
});

test.describe('vulnerabilities as analyst', () => {
  asRole('analyst');

  test('Exportación STIX', ({ page }) =>
    expectScreen(page, '/exportacion-stix', 'Exportación STIX'));

  test('offers the demo vulnerabilities to export', async ({ page }) => {
    await page.goto('/exportacion-stix');
    const picker = page.getByRole('combobox', { name: 'Vulnerabilidad' });
    await expect(picker.getByRole('option', { name: 'CVE-2026-10001 · OpenSSL' })).toBeAttached();
    await picker.selectOption({ label: 'CVE-2026-10001 · OpenSSL' });
    await expect(page.getByRole('button', { name: 'Exportar y descargar' })).toBeEnabled();
  });

  test('links the STIX export from the detail', async ({ page }) => {
    await page.goto('/vulnerabilidades');
    await page.getByRole('link', { name: 'CVE-2026-10001' }).click();
    await expect(page.getByRole('link', { name: 'Exportar STIX' })).toBeVisible();
  });
});
