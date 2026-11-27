import { asRole, expectScreen, test } from '../support/fixtures';

// Smoke test of src/app/features/agents/ (lane A · Agentes y operación), owned by
// that lane: extend it as the screens grow (data shown, filters, empty and error states, actions by role,
// accessibility).
test.describe('agents as reader', () => {
  asRole('reader');

  test('Panel de agentes', ({ page }) => expectScreen(page, '/agentes', 'Panel de agentes'));
  test('Historial', ({ page }) => expectScreen(page, '/historial-agente', 'Historial'));
  test('Métricas', ({ page }) => expectScreen(page, '/metricas', 'Métricas'));
});
