import { asRole, expectScreen, test } from '../support/fixtures';

// Smoke test of src/app/features/home/ (lane A · Agentes y operación), owned by
// that lane: extend it as the screens grow (data shown, filters, empty and error states, actions by role,
// accessibility).
test.describe('home as reader', () => {
  asRole('reader');

  test('Inicio', ({ page }) => expectScreen(page, '/inicio', 'Inicio'));
});
