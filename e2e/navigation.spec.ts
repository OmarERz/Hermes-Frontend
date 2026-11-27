import { asRole, expect, test } from './support/fixtures';
import type { Role } from './support/roles';

// Menu and tabs per role (src/app/core/navigation/navigation.ts) and the role guards of the routes.
const SECTIONS = [
  'Inicio',
  'Agentes',
  'Vulnerabilidades',
  'Inventario',
  'Configuración',
  'Operación',
];

const TABS: Record<Role, { vulnerabilities: string[]; operations: string[] }> = {
  reader: {
    vulnerabilities: ['Por grupo', 'Comparación', 'Tickets y alertas'],
    // A single tab is not drawn.
    operations: [],
  },
  analyst: {
    vulnerabilities: ['Por grupo', 'Comparación', 'Tickets y alertas', 'Exportación STIX'],
    operations: [],
  },
  admin: {
    vulnerabilities: ['Por grupo', 'Comparación', 'Tickets y alertas', 'Exportación STIX'],
    operations: ['Corridas', 'Usuarios', 'Conexiones', 'Auditoría', 'Cola de errores', 'Asistente'],
  },
};

for (const role of ['reader', 'analyst', 'admin'] as const) {
  test.describe(`navigation as ${role}`, () => {
    asRole(role);

    test('shows every section in the menu and the tabs the role can open', async ({ page }) => {
      await page.goto('/inicio');
      const menu = page.getByRole('navigation', { name: 'Navegación principal' });
      await expect(menu.getByRole('link')).toHaveText(SECTIONS);

      await menu.getByRole('link', { name: 'Vulnerabilidades' }).click();
      await expect(page).toHaveURL(/\/vulnerabilidades$/);
      const vulnerabilityTabs = page.getByRole('navigation', {
        name: 'Secciones de Vulnerabilidades',
      });
      await expect(vulnerabilityTabs.getByRole('link')).toHaveText(TABS[role].vulnerabilities);

      await menu.getByRole('link', { name: 'Operación' }).click();
      await expect(page).toHaveURL(/\/corridas$/);
      const operationTabs = page.getByRole('navigation', { name: 'Secciones de Operación' });
      if (TABS[role].operations.length) {
        await expect(operationTabs.getByRole('link')).toHaveText(TABS[role].operations);
      } else {
        await expect(operationTabs).toHaveCount(0);
      }
    });
  });
}

test.describe('role guards', () => {
  test.describe('as reader', () => {
    asRole('reader');
    for (const path of ['/exportacion-stix', '/usuarios', '/auditoria']) {
      test(`sends ${path} to the forbidden screen`, async ({ page }) => {
        await page.goto(path);
        await expect(page).toHaveURL(/\/sin-permiso$/);
        await expect(page.getByRole('alert')).toContainText('Lector');
      });
    }
  });

  test.describe('as analyst', () => {
    asRole('analyst');
    test('opens the STIX export but not the admin screens', async ({ page }) => {
      await page.goto('/exportacion-stix');
      await expect(page).toHaveURL(/\/exportacion-stix$/);
      await page.goto('/cola-errores');
      await expect(page).toHaveURL(/\/sin-permiso$/);
    });
  });

  test.describe('as admin', () => {
    asRole('admin');
    test('opens the admin screens', async ({ page }) => {
      await page.goto('/usuarios');
      await expect(page).toHaveURL(/\/usuarios$/);
    });

    test('signs out from the profile menu', async ({ page }) => {
      await page.goto('/inicio');
      await page.locator('.sidebar-profile .profile-trigger').click();
      await page.getByRole('button', { name: 'Cerrar sesión' }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.goto('/inicio');
      await expect(page).toHaveURL(/\/login$/);
    });
  });

  test('sends a visitor without a session to the login', async ({ page }) => {
    await page.goto('/vulnerabilidades');
    await expect(page).toHaveURL(/\/login$/);
  });
});
