import { asRole, expect, expectScreen, test } from '../support/fixtures';

// src/app/features/home/ (lane A · Agentes y operación), against the backend's demo data (`make demo`). Owned by
// that lane. The values depend on the demo, so the checks are about real data being shown, not about the numbers.
const VALUE = /^(\d[\d,]*|\d+(\.\d+)? %|Sin datos)$/;

test.describe('home as reader', () => {
  asRole('reader');

  test('Inicio', ({ page }) => expectScreen(page, '/inicio', 'Inicio'));

  test('fills the four summary cards with the real inventory, tickets and judge', async ({
    page,
  }) => {
    await page.goto('/inicio');
    const summary = page.getByRole('region', { name: 'Indicadores resumidos' });
    const cards = summary.locator('.home-metric');
    await expect(cards.locator('small')).toHaveText([
      'Software instalado',
      'Activos en iTop',
      'Tickets abiertos',
      'Éxito del agente juez (7 días)',
    ]);
    for (const value of await cards.locator('strong').all()) await expect(value).toHaveText(VALUE);
    await expect(summary.getByRole('alert')).toHaveCount(0);
    await expect(summary.getByRole('status')).toContainText('última sincronización con iTop');
  });

  // INI-1 (F19.6): at 1280 px the cards were ≈ 240 px wide and long words ran under the arrow button.
  test('keeps the text of every module card clear of its arrow', async ({ page }) => {
    await page.goto('/inicio');
    const cards = page.getByRole('navigation', { name: 'Módulos principales' }).getByRole('link');
    await expect(cards).toHaveCount(4);
    for (const width of [1280, 1100, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const clashes = await cards.evaluateAll((links) =>
        links.flatMap((link) => {
          const copy = link.querySelector('.home-card-copy');
          const arrow = link.querySelector('.home-card-arrow');
          if (!copy || !arrow) return ['missing parts'];
          const text = document.createRange();
          text.selectNodeContents(copy);
          const gap = arrow.getBoundingClientRect().left - text.getBoundingClientRect().right;
          return gap < 0
            ? [`${copy.textContent?.trim().split(/\s+/)[0]}: ${Math.round(gap)} px`]
            : [];
        }),
      );
      expect(clashes, `module cards at ${width} px`).toEqual([]);
    }
  });

  test('links the main modules', async ({ page }) => {
    await page.goto('/inicio');
    const modules = page.getByRole('navigation', { name: 'Módulos principales' });
    await modules.getByRole('link', { name: /^Agentes/ }).click();
    await expect(page).toHaveURL(/\/agentes$/);
  });
});
