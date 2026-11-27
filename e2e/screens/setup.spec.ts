import { asRole, expectScreen, test } from '../support/fixtures';

// Smoke test of src/app/features/setup/ (lane Asistente), owned by
// that lane: extend it as the screens grow (data shown, filters, empty and error states, actions by role,
// accessibility).
test.describe('setup as admin', () => {
  asRole('admin');

  test('Asistente de configuración', ({ page }) =>
    expectScreen(page, '/asistente', 'Asistente de configuración'));
});
