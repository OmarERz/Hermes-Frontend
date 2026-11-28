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
  'user.create_requested': 'Pidió crear una cuenta',
  'user.create': 'Creó una cuenta',
  'user.create_failed': 'Falló la creación de una cuenta',
  'user.password_email_requested': 'Pidió el correo para crear la contraseña',
  'user.password_email_sent': 'Se envió el correo para crear la contraseña',
  'user.password_email_failed': 'Falló el envío del correo para crear la contraseña',
  'user.disable_requested': 'Pidió desactivar una cuenta',
  'user.disable': 'Desactivó una cuenta',
  'user.disable_failed': 'Falló la desactivación de una cuenta',
  'user.enable_requested': 'Pidió reactivar una cuenta',
  'user.enable': 'Reactivó una cuenta',
  'user.enable_failed': 'Falló la reactivación de una cuenta',
};

export const KNOWN_AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS);

/** The Spanish name of an action, or null when the front does not know it yet. */
/**
 * Spanish names of the audited object kinds (AuditLog `entity_type` in the backend). The table shows «kind:id» as the
 * kind's name with the id under it; a kind not listed here is shown as it comes (AUD-2).
 */
export const AUDIT_TARGET_LABELS: Readonly<Record<string, string>> = {
  app_user: 'Cuenta',
  calibration_proposal: 'Propuesta de calibración',
  company_profile: 'Perfil de la empresa',
  config: 'Configuración',
  cpe_mapping: 'Mapeo de CPE',
  peer_company: 'Empresa par',
  setup_step: 'Paso del asistente',
  source: 'Fuente',
  stix_bundle: 'Paquete STIX',
};

/** «kind:id» as the kind's Spanish name and the id; null when the kind is not known. */
export function auditTarget(target: string): { label: string; id: string } | null {
  const at = target.indexOf(':');
  if (at <= 0) return null;
  const kind = target.slice(0, at);
  return Object.hasOwn(AUDIT_TARGET_LABELS, kind)
    ? { label: AUDIT_TARGET_LABELS[kind], id: target.slice(at + 1) }
    : null;
}

export function auditActionLabel(action: string): string | null {
  return Object.hasOwn(AUDIT_ACTION_LABELS, action) ? AUDIT_ACTION_LABELS[action] : null;
}
