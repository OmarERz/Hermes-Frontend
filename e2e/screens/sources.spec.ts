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
});

test.describe('sources as admin', () => {
  asRole('admin');

  test('offers to add a source', async ({ page }) => {
    await page.goto('/fuentes');
    await expect(page.getByRole('button', { name: 'Agregar fuente' })).toBeVisible();
  });
});
