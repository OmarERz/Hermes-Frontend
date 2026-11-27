import { asRole, expectScreen, test } from '../support/fixtures';

// Smoke test of src/app/features/inventory/ (lane B · Inventario), owned by
// that lane: extend it as the screens grow (data shown, filters, empty and error states, actions by role,
// accessibility).
test.describe('inventory as reader', () => {
  asRole('reader');

  test('Activos', ({ page }) => expectScreen(page, '/activos', 'Activos'));
  test('Software', ({ page }) => expectScreen(page, '/software', 'Software'));
  test('Pendientes de inventario', ({ page }) =>
    expectScreen(page, '/pendientes-inventario', 'Pendientes de inventario'));
});
