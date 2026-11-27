import { asRole, expectScreen, test } from '../support/fixtures';

// Smoke test of src/app/features/company/ (lane F1 · Fuentes y empresa), owned by
// that lane: extend it as the screens grow (data shown, filters, empty and error states, actions by role,
// accessibility).
test.describe('company as reader', () => {
  asRole('reader');

  test('Empresa', ({ page }) => expectScreen(page, '/empresa', 'Empresa'));
});
