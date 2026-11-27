import { asRole, expectScreen, test } from '../support/fixtures';

// Smoke test of src/app/features/admin/ (lane F2 · Corridas y administración), owned by
// that lane: extend it as the screens grow (data shown, filters, empty and error states, actions by role,
// accessibility).
test.describe('admin as admin', () => {
  asRole('admin');

  test('Usuarios y roles', ({ page }) => expectScreen(page, '/usuarios', 'Usuarios y roles'));
  test('Auditoría', ({ page }) => expectScreen(page, '/auditoria', 'Auditoría'));
  test('Cola de errores', ({ page }) => expectScreen(page, '/cola-errores', 'Cola de errores'));
});
