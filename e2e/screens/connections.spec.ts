import { asRole, expect, expectScreen, test } from '../support/fixtures';

// src/app/features/connections/ (lane F1 · Fuentes y empresa), an admin screen (the role guards are in
// navigation.spec.ts). Owned by that lane: extend it as the screen grows. «Probar todas» is not pressed: it calls
// the configured services.
test.describe('connections as admin', () => {
  asRole('admin');

  test('Conexiones', ({ page }) => expectScreen(page, '/conexiones', 'Conexiones'));

  test('lists the connections of the stack', async ({ page }) => {
    await page.goto('/conexiones');
    // The action turns on once the connections loaded.
    await expect(page.getByRole('button', { name: 'Probar todas' })).toBeEnabled();
    const table = page.getByRole('region', { name: /; desplazamiento horizontal$/ }).first();
    await expect(table.getByRole('row').nth(1)).toBeVisible();
  });
});
