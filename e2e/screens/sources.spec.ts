import { asRole, expect, expectScreen, test } from '../support/fixtures';

// src/app/features/sources/ (lane F1 · Fuentes y empresa), against the sources the backend's bootstrap and demo
// load. Owned by that lane: extend it as the screens grow (filters, details, empty and error states).
test.describe('sources as reader', () => {
  asRole('reader');

  test('Fuentes', ({ page }) => expectScreen(page, '/fuentes', 'Fuentes'));

  test('lists the configured sources without the add action', async ({ page }) => {
    await page.goto('/fuentes');
    const health = page.getByRole('region', {
      name: 'Salud de las fuentes; desplazamiento horizontal',
    });
    // Header row plus at least one source.
    await expect(health.getByRole('row').nth(1)).toBeVisible();
    // Adding a source is for admins (ACTION_ROLES.addSource).
    await expect(page.getByRole('button', { name: 'Agregar fuente' })).toHaveCount(0);
  });

  // FUE-2 (F19.6): no card under the centre one and none past the carousel's edges, at any width.
  test('lays the carousel cards side by side without overlapping or cutting them', async ({
    page,
  }) => {
    await page.goto('/fuentes');
    await expect(page.locator('.carousel-card.center-card')).toBeVisible();
    for (const width of [1920, 1280, 1024, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      // The cards slide (0.28 s) to their new place: read them once they stopped.
      await page.waitForTimeout(400);
      const problems = await page.evaluate(() => {
        const section = document.querySelector('.carousel-section')!.getBoundingClientRect();
        const center = document
          .querySelector('.carousel-card.center-card')!
          .getBoundingClientRect();
        const found: string[] = [];
        for (const card of document.querySelectorAll<HTMLElement>('.carousel-card')) {
          const box = card.getBoundingClientRect();
          if (!box.width) continue; // not shown at this width
          const offset = card.dataset['offset'];
          if (box.left < section.left - 1 || box.right > section.right + 1) {
            found.push(`card ${offset} past the edge`);
          }
          // A side card behind the centre one shows nothing readable (only below 840 px of carousel).
          const behind = box.left < center.right && box.right > center.left;
          const readable = card
            .querySelector<HTMLElement>('.feed-card-select > strong, .feed-card-heading')
            ?.checkVisibility({ opacityProperty: true });
          if (offset !== '0' && behind && readable)
            found.push(`card ${offset} readable under the centre`);
        }
        return found;
      });
      expect(problems, `carousel at ${width} px`).toEqual([]);
    }
  });
});

test.describe('sources as admin', () => {
  asRole('admin');

  test('offers to add a source', async ({ page }) => {
    await page.goto('/fuentes');
    await expect(page.getByRole('button', { name: 'Agregar fuente' })).toBeVisible();
  });
});
