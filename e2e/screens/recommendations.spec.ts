import { asRole, expect, expectScreen, test } from '../support/fixtures';

// src/app/features/recommendations/ (lane D · Recomendaciones y feedback), against the backend's demo data (one
// assessment for CVE-2026-10001 in OpenSSL and one for CVE-2026-10002 in nginx). Owned by that lane: extend it as
// the screens grow (filters, history, empty and error states).
test.describe('recommendations as reader', () => {
  asRole('reader');

  test('Recomendaciones', ({ page }) =>
    expectScreen(page, '/recomendaciones-agente', 'Recomendaciones'));

  test('shows the demo assessments without the feedback action', async ({ page }) => {
    await page.goto('/recomendaciones-agente');
    const cases = page.getByRole('complementary', { name: 'Vulnerabilidades con recomendaciones' });
    await expect(cases.getByRole('button', { name: /CVE-2026-10002/ })).toBeVisible();
    await cases.getByRole('button', { name: /CVE-2026-10001/ }).click();

    await expect(page.getByRole('heading', { name: 'CVE-2026-10001 · OpenSSL' })).toBeVisible();
    const card = page.getByRole('article').filter({ hasText: 'Puntaje por etapa' }).first();
    await expect(card.getByRole('heading', { level: 3 })).toContainText(/Final \d+ · Crítica/);
    await expect(card.getByRole('region', { name: 'Puntaje por etapa' })).toContainText(
      'Ajuste del juez',
    );
    // Feedback is for analysts and admins (ACTION_ROLES.giveFeedback).
    await expect(page.getByRole('button', { name: 'Ver historial de feedback' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dar feedback' })).toHaveCount(0);
  });
});

test.describe('recommendations as analyst', () => {
  asRole('analyst');

  test('sends feedback on an assessment', async ({ page }) => {
    await page.goto('/recomendaciones-agente');
    const cases = page.getByRole('complementary', { name: 'Vulnerabilidades con recomendaciones' });
    await cases.getByRole('button', { name: /CVE-2026-10002/ }).click();
    await expect(page.getByRole('heading', { name: 'CVE-2026-10002 · nginx' })).toBeVisible();

    await page.getByRole('button', { name: 'Dar feedback' }).click();
    const dialog = page.getByRole('dialog', { name: 'Revisión humana' });
    await expect(dialog).toBeVisible();
    // «Investigando» changes nothing else of the demo data (no suppression, no ticket action).
    await dialog.getByRole('radio', { name: /Investigando/ }).check();
    await dialog.getByRole('button', { name: 'Guardar feedback' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: 'Feedback guardado' })).toBeVisible();
  });
});
