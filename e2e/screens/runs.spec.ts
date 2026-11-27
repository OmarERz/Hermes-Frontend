import { asRole, expect, expectScreen, settle, test } from '../support/fixtures';

// src/app/features/runs/ (lane F2 · Corridas y administración), against the backend's demo data (`make demo`: one
// simulated scan and one news run, both finished). Owned by that lane. No test launches a scan: the worker would
// scan the demo inventory again while the other specs read it in parallel; launching and the live progress are
// covered by the unit tests of the screen and of its event stream client.
test.describe('runs as reader', () => {
  asRole('reader');

  test('Corridas', ({ page }) => expectScreen(page, '/corridas', 'Corridas'));

  test('lists the demo runs, opens one and filters by kind, without the launch action', async ({
    page,
  }) => {
    await page.goto('/corridas');
    const table = page.getByRole('region', { name: 'Corridas; desplazamiento horizontal' });
    const news = table.getByRole('row').filter({ hasText: 'Ingesta de noticias' }).first();
    await expect(news).toContainText('Terminó bien');
    await expect(news.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    // The counts of the last 24 hours come from the telemetry summary.
    await expect(page.getByRole('region', { name: 'Resumen de corridas' })).not.toContainText('—');
    // Launching a scan is for analysts and admins (ACTION_ROLES.launchScan).
    await expect(page.getByRole('button', { name: 'Lanzar escaneo' })).toHaveCount(0);

    await news.getByRole('button', { name: 'Ver detalle' }).click();
    const detail = page.getByRole('region', { name: 'Ingesta de noticias' });
    await expect(detail.getByRole('progressbar', { name: 'Avance de la corrida' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    await expect(detail).toContainText('Identificador');
    await detail.getByRole('button', { name: 'Cerrar el detalle de la corrida' }).click();
    await expect(detail).toHaveCount(0);

    await page.getByRole('combobox', { name: 'Tipo de corrida' }).selectOption('ingestion');
    await expect(
      table.getByRole('row').filter({ hasText: 'Escaneo de vulnerabilidades' }),
    ).toHaveCount(0);
    await expect(
      table.getByRole('row').filter({ hasText: 'Ingesta de noticias' }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    await expect(page.getByRole('button', { name: 'Quitar filtros' })).toHaveCount(0);
    await settle(page);
  });
});

test.describe('runs as analyst', () => {
  asRole('analyst');

  test('offers to launch a scan', async ({ page }) => {
    await page.goto('/corridas');
    await expect(page.getByRole('button', { name: 'Lanzar escaneo' })).toBeEnabled();
  });
});
