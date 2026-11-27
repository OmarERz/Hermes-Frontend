import { asRole, expectScreen, test } from '../support/fixtures';

// Smoke test of src/app/features/runs/ (lane F2 · Corridas y administración), owned by
// that lane: extend it as the screens grow (data shown, filters, empty and error states, actions by role,
// accessibility).
test.describe('runs as reader', () => {
  asRole('reader');

  test('Corridas', ({ page }) => expectScreen(page, '/corridas', 'Corridas'));
});
