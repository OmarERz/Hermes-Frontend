import { asRole, expectScreen, test } from '../support/fixtures';

// Smoke test of src/app/features/sources/ (lane F1 · Fuentes y empresa), owned by
// that lane: extend it as the screens grow (data shown, filters, empty and error states, actions by role,
// accessibility).
test.describe('sources as reader', () => {
  asRole('reader');

  test('Fuentes', ({ page }) => expectScreen(page, '/fuentes', 'Fuentes'));
});
