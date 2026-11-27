import type { Page } from '@playwright/test';
import type { Role } from '../support/roles';

/** An extra view of a screen reached by an interaction (a dialog, a detail panel, a chart tab). */
export interface Variant {
  name: string;
  /** A modal dialog: captured at the viewport size, as the person sees it (a full-page capture misplaces it). */
  dialog?: boolean;
  /** Brings the opened screen to this view. Never saves anything: dialogs are only opened. */
  act(page: Page): Promise<void>;
}

/** One screen of the app, as the route table and the navigation define it (src/app/app.routes.ts). */
export interface Screen {
  /** Stable id, used in the output paths. */
  id: string;
  /** Route path (detail screens: the list they are opened from). */
  path: string;
  /** Minimum role (data.minRole of the route). */
  minRole: Role;
  /** Still the prototype screen or a placeholder: skipped unless E2E_DESIGN_PENDING=1. */
  pending?: boolean;
  /** Opens a screen that has no fixed path (a detail), starting from `path`. */
  open?(page: Page): Promise<void>;
  /** Extra views, captured as admin only. */
  variants?: Variant[];
}

const RANK: Record<Role, number> = { reader: 0, analyst: 1, admin: 2 };

export function canOpen(role: Role, screen: Screen): boolean {
  return RANK[role] >= RANK[screen.minRole];
}

async function openFirstVulnerability(page: Page): Promise<void> {
  await page
    .getByRole('region', { name: 'Vulnerabilidades; desplazamiento horizontal' })
    .getByRole('link', { name: /^CVE-/ })
    .first()
    .click();
  await page.waitForURL(/\/vulnerabilidades\/[0-9a-f-]+$/);
}

async function selectFirstRecommendation(page: Page): Promise<void> {
  await page
    .getByRole('complementary', { name: 'Vulnerabilidades con recomendaciones' })
    .getByRole('button', { name: /CVE-/ })
    .first()
    .click();
}

/**
 * Every screen of the app. Detail screens open from their list; the variants use the same accessible names as the
 * screen specs (e2e/screens/), so a renamed control breaks both. Flip `pending` off when a lane replaces the entry.
 */
export const SCREENS: readonly Screen[] = [
  {
    id: 'home',
    path: '/inicio',
    minRole: 'reader',
    variants: [
      {
        // The profile menu with the theme switch: in the sidebar, the compact sidebar and the bottom bar.
        name: 'profile-menu',
        dialog: true,
        act: async (page) => {
          await page.locator('.sidebar-profile .profile-trigger').dispatchEvent('click');
          await page.locator('.profile-dropdown .theme-toggle').waitFor();
        },
      },
    ],
  },
  { id: 'agents', path: '/agentes', minRole: 'reader' },
  {
    id: 'agents-history',
    path: '/historial-agente',
    minRole: 'reader',
    variants: [
      {
        name: 'judge-detail',
        act: async (page) => {
          await page
            .getByRole('region', { name: 'Historial de eventos; desplazamiento horizontal' })
            .getByRole('row')
            .filter({ hasText: 'Revisión del juez' })
            .first()
            .getByRole('button', { name: 'Detalle' })
            .click();
          await page.locator('aside.detail-panel').waitFor();
        },
      },
    ],
  },
  {
    id: 'recommendations',
    path: '/recomendaciones-agente',
    minRole: 'reader',
    variants: [
      { name: 'detail', act: selectFirstRecommendation },
      {
        name: 'feedback-dialog',
        dialog: true,
        act: async (page) => {
          await selectFirstRecommendation(page);
          await page.getByRole('button', { name: 'Dar feedback' }).click();
          await page.getByRole('dialog', { name: 'Revisión humana' }).waitFor();
        },
      },
    ],
  },
  { id: 'metrics', path: '/metricas', minRole: 'reader' },
  { id: 'vulnerabilities', path: '/vulnerabilidades', minRole: 'reader' },
  {
    id: 'vulnerability-detail',
    path: '/vulnerabilidades',
    minRole: 'reader',
    open: openFirstVulnerability,
    variants: [
      {
        name: 'history',
        act: async (page) => {
          await page.getByRole('button', { name: 'Historial y cascada' }).first().click();
          await page.locator('app-grafico-dashboard svg').first().waitFor();
        },
      },
    ],
  },
  { id: 'comparison', path: '/comparacion', minRole: 'reader' },
  { id: 'tickets', path: '/tickets', minRole: 'reader' },
  { id: 'stix-export', path: '/exportacion-stix', minRole: 'analyst' },
  { id: 'assets', path: '/activos', minRole: 'reader' },
  {
    id: 'asset-detail',
    path: '/activos',
    minRole: 'reader',
    open: async (page) => {
      await page.locator('main a[href^="/activos/"]').first().click();
      await page.waitForURL(/\/activos\/[^/]+$/);
    },
  },
  { id: 'software', path: '/software', minRole: 'reader' },
  { id: 'pending-inventory', path: '/pendientes-inventario', minRole: 'reader' },
  { id: 'judge-settings', path: '/configuracion-agente', minRole: 'reader' },
  { id: 'formula', path: '/formula', minRole: 'reader' },
  { id: 'parameters', path: '/parametros', minRole: 'reader' },
  { id: 'calibration', path: '/calibracion', minRole: 'reader' },
  {
    id: 'sources',
    path: '/fuentes',
    minRole: 'reader',
    variants: [
      {
        name: 'add-form',
        act: (page) => page.getByRole('button', { name: 'Agregar fuente' }).click(),
      },
    ],
  },
  {
    id: 'company',
    path: '/empresa',
    minRole: 'reader',
    variants: [
      {
        name: 'edit-profile',
        act: (page) => page.getByRole('button', { name: 'Editar perfil' }).click(),
      },
      {
        name: 'add-peer',
        act: (page) => page.getByRole('button', { name: 'Agregar empresa' }).click(),
      },
    ],
  },
  {
    id: 'runs',
    path: '/corridas',
    minRole: 'reader',
    variants: [
      {
        name: 'detail',
        act: async (page) => {
          await page
            .getByRole('region', { name: 'Corridas; desplazamiento horizontal' })
            .getByRole('button', { name: 'Ver detalle' })
            .first()
            .click();
          await page.getByRole('progressbar', { name: 'Avance de la corrida' }).waitFor();
        },
      },
    ],
  },
  {
    id: 'users',
    path: '/usuarios',
    minRole: 'admin',
    variants: [
      {
        // Opens the confirmation only: saving a role revokes that user's sessions, which other tests use.
        name: 'role-dialog',
        dialog: true,
        act: async (page) => {
          await page
            .getByRole('region', { name: 'Cuentas; desplazamiento horizontal' })
            .getByRole('row')
            .filter({ hasText: 'reader@hermes.test' })
            .getByRole('combobox')
            .selectOption('analyst');
          await page.getByRole('dialog', { name: 'Confirmar cambio de rol' }).waitFor();
        },
      },
    ],
  },
  { id: 'connections', path: '/conexiones', minRole: 'admin' },
  { id: 'audit', path: '/auditoria', minRole: 'admin' },
  { id: 'error-queue', path: '/cola-errores', minRole: 'admin' },
  { id: 'setup', path: '/asistente', minRole: 'admin' },
];

/** A screen each non-admin role cannot open: it lands on the forbidden screen (/sin-permiso). */
export const FORBIDDEN_PATH: Record<Exclude<Role, 'admin'>, string> = {
  reader: '/exportacion-stix',
  analyst: '/usuarios',
};
