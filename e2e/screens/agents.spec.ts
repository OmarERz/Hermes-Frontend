import { asRole, expect, expectScreen, settle, test } from '../support/fixtures';

// src/app/features/agents/ (lane A · Agentes y operación), against the backend's demo data (`make demo`: a full
// cycle with the judge, the news analyst, tickets DEMO-1 and DEMO-2 and the daily metrics). Owned by that lane. The
// values depend on the demo, so the checks are about real data being shown, not about the numbers.
test.describe('agents as reader', () => {
  asRole('reader');

  test('Panel de agentes', ({ page }) => expectScreen(page, '/agentes', 'Panel de agentes'));
  test('Historial', ({ page }) => expectScreen(page, '/historial-agente', 'Historial'));
  test('Métricas', ({ page }) => expectScreen(page, '/metricas', 'Métricas'));

  test('shows the telemetry, the three agents and the tickets, with charts within the CSP', async ({
    page,
  }) => {
    await page.goto('/agentes');
    await expect(page.locator('.performance .kpi-grid > app-kpi-card')).toHaveCount(5);
    await expect(page.locator('.performance .kpi-value').first()).toHaveText(/%$|^Sin datos$/);
    await expect(page.locator('.agent-block h3')).toHaveText([
      /^\s*Juez/,
      /^\s*Analista de noticias/,
      /^\s*Analista de CVE/,
    ]);
    await expect(page.locator('.ticket-kpis > app-kpi-card')).toHaveCount(9);
    const charts = page.locator('app-grafico-dashboard');
    await expect(charts.first().locator('svg')).toBeVisible();
    // The last run that started, with its state and date.
    await expect(page.locator('.last-run')).toHaveText(/Última corrida: .+ · .+ · .+/);
    // The connections are admin only (AG-4).
    await expect(page.getByText('Conexiones externas')).toHaveCount(0);
    await settle(page);
  });

  test('says once that the panel could not be read, with one retry for all its reads', async ({
    page,
  }) => {
    // Every read of the panel fails (the reviews log has its own state and is left alone).
    let failing = true;
    await page.route(
      /\/api\/(telemetry\/(summary|daily)|tickets\/summary|history|metrics)(\?|$)/,
      (route) =>
        failing
          ? route.fulfill({
              status: 500,
              json: { error: { code: 'internal_error', message: 'Error interno del servidor.' } },
            })
          : route.fallback(),
    );
    await page.goto('/agentes');
    const notice = page.locator('app-async-state.page-notice');
    await expect(notice).toContainText('Error interno del servidor.');
    await expect(page.getByRole('button', { name: 'Reintentar todo' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toHaveCount(0);

    failing = false;
    await page.getByRole('button', { name: 'Reintentar todo' }).click();
    await expect(notice).toHaveCount(0);
    await expect(page.locator('.performance .kpi-grid > app-kpi-card')).toHaveCount(5);
  });

  test('changes the window of the telemetry and lists the LLM reviews', async ({ page }) => {
    await page.goto('/agentes');
    await page.getByLabel('Ventana de tiempo').selectOption({ label: 'Últimos 30 días' });
    await expect(
      page.getByRole('heading', { name: /Corridas por día \(últimos 30 días\)/ }),
    ).toBeVisible();

    const log = page.locator('app-reviews-log');
    const reviews = log.getByRole('region', {
      name: 'Revisiones de IA; desplazamiento horizontal',
    });
    await expect(
      reviews.getByRole('row').filter({ hasText: 'Analista de noticias' }).first(),
    ).toBeVisible();
    await log.getByLabel('Agente').selectOption({ label: 'Juez' });
    await expect(reviews.getByRole('row').filter({ hasText: 'Analista de noticias' })).toHaveCount(
      0,
    );
    await expect(reviews.getByRole('row').nth(1)).toContainText('Juez');
  });

  test('opens the decision of the judge from the history and filters the timeline', async ({
    page,
  }) => {
    await page.goto('/historial-agente');
    const events = page.getByRole('region', {
      name: 'Historial de eventos; desplazamiento horizontal',
    });
    const judgeReview = events.getByRole('row').filter({ hasText: 'Revisión del juez' }).first();
    await judgeReview.getByRole('button', { name: 'Detalle' }).click();
    const detail = page.locator('aside.detail-panel');
    await expect(detail.getByRole('heading', { name: 'Decisión del juez' })).toBeVisible();
    await expect(detail.getByRole('heading', { name: 'Intervención humana' })).toBeVisible();
    await expect(
      detail.getByRole('link', { name: 'Ver la recomendación y su feedback' }),
    ).toBeVisible();

    await page.getByLabel('Tipo de evento').selectOption({ label: 'Corrida' });
    await expect(detail.getByRole('heading', { name: 'Detalle del evento' })).toBeVisible();
    await expect(events.getByRole('row').nth(1)).toContainText('Corrida');
    await expect(events.getByRole('row').filter({ hasText: 'Revisión de IA' })).toHaveCount(0);
  });

  test('shows the ticket log with its iTop writes', async ({ page }) => {
    await page.goto('/historial-agente');
    const log = page.getByRole('region', {
      name: 'Bitácora de tickets; desplazamiento horizontal',
    });
    await expect(log.getByRole('row').filter({ hasText: 'DEMO-1' }).first()).toContainText(
      'Ticket creado',
    );
    // A reference is not the iTop id the filter takes: it is not sent.
    await page.getByLabel('Id del ticket en iTop').fill('R-000123');
    await page.getByLabel('Id del ticket en iTop').press('Enter');
    await expect(page.locator('#ticket-error')).toContainText('id numérico del ticket');
  });

  test('shows the metrics board by section and the daily cost chart', async ({ page }) => {
    await page.goto('/metricas');
    await expect(page.getByRole('heading', { name: 'Juez', exact: true })).toBeVisible();
    await expect(page.locator('[data-metric="judge_ladder_level"] strong')).toHaveText(/·/);
    await expect(page.getByRole('heading', { name: 'Costo de IA por día' })).toBeVisible();
    await expect(page.locator('.cost-chart svg')).toBeVisible();
    await settle(page);
  });
});

test.describe('agents as admin', () => {
  asRole('admin');

  test('shows the state of the external connections next to the agents (AG-4)', async ({
    page,
  }) => {
    await page.goto('/agentes');
    const line = page.locator('.connections');
    await expect(line).toContainText('Conexiones externas:');
    await expect(line.locator('strong')).toHaveText(/^\d+ de \d+ funcionan$/);
    await expect(line.getByRole('link', { name: 'Ver conexiones' })).toHaveAttribute(
      'href',
      '/conexiones',
    );
  });
});
