import type { Role } from '../api/api-types';

const RANK: Record<Role, number> = { reader: 0, analyst: 1, admin: 2 };

/** Spanish label of each role, for the profile menu and messages. */
export const ROLE_LABELS: Record<Role, string> = {
  reader: 'Lector',
  analyst: 'Analista',
  admin: 'Administrador',
};

/** Role hierarchy of the backend: reader < analyst < admin (FRONTEND.md §2). */
export function roleAtLeast(role: Role | null | undefined, minimum: Role): boolean {
  return role !== null && role !== undefined && RANK[role] >= RANK[minimum];
}

/** Route data key with the minimum role of a screen (the backend role of the route it calls). */
export const MIN_ROLE = 'minRole';

/**
 * Minimum role per backend operation that hides or disables an action, from ROUTE_ROLES in the backend
 * (src/api/routes/_auth.py). The backend still enforces it; the front only avoids offering what fails.
 */
export const ACTION_ROLES = {
  viewVulnerabilities: 'reader',
  launchScan: 'analyst',
  giveFeedback: 'analyst',
  exportStix: 'analyst',
  mapCpe: 'analyst',
  toggleSource: 'analyst',
  addSource: 'admin',
  editProfile: 'admin',
  simulateFormula: 'admin',
  restoreConfigVersion: 'admin',
  decideCalibration: 'admin',
  manageUsers: 'admin',
  viewAudit: 'admin',
} as const satisfies Record<string, Role>;
