/**
 * Spanish names of the audit actions the backend records today (AuditLog `action` in its routes and services). The
 * action itself stays visible next to its name, and an action not listed here is shown as it comes.
 */
export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {
  'config.update': 'Cambió la configuración',
  'config.restore': 'Restauró una versión de la configuración',
  'profile.update': 'Cambió el perfil de la empresa',
  'peer_company.create': 'Agregó una empresa par',
  'peer_company.update': 'Cambió una empresa par',
  'peer_company.delete': 'Quitó una empresa par',
  'source.create': 'Agregó una fuente',
  'source.enable': 'Activó una fuente',
  'source.disable': 'Desactivó una fuente',
  'source.trust_tier': 'Cambió el nivel de una fuente',
  'source.down': 'Una fuente dejó de responder',
  'source.recovered': 'Una fuente se recuperó',
  'calibration.approve': 'Aprobó una propuesta de calibración',
  'calibration.reject': 'Rechazó una propuesta de calibración',
  cpe_mapping_set: 'Mapeó software a un CPE',
  stix_exported: 'Exportó STIX',
  'setup.step': 'Marcó un paso del asistente',
  user_created: 'Se registró una cuenta en Hermes',
  role_assignment_requested: 'Pidió asignar un rol',
  role_assigned: 'Asignó un rol',
  role_assignment_failed: 'Falló la asignación de un rol',
};

export const KNOWN_AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS);

/** The Spanish name of an action, or null when the front does not know it yet. */
export function auditActionLabel(action: string): string | null {
  return Object.hasOwn(AUDIT_ACTION_LABELS, action) ? AUDIT_ACTION_LABELS[action] : null;
}
