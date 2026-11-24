import type { VulnerabilityGroup } from '../core/api/api-types';

export type Level = VulnerabilityGroup['level'];
export type FindingStatus = VulnerabilityGroup['status'];
export type Classification = VulnerabilityGroup['classification'];

/** Spanish names of the backend enums (the OpenAPI descriptions), for people. Order: most to least urgent. */
export const LEVEL_LABELS: Record<Level, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export const STATUS_LABELS: Record<FindingStatus, string> = {
  new: 'Nuevo',
  persistent: 'Persistente',
  reopened: 'Reabierto',
  fixed: 'Corregido',
  no_data: 'Sin datos',
};

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  public: 'Pública',
  classified: 'Clasificada',
  highly_classified: 'Altamente clasificada',
  unclassified: 'Sin clasificación',
};

export const LEVELS = Object.keys(LEVEL_LABELS) as Level[];
export const STATUSES = Object.keys(STATUS_LABELS) as FindingStatus[];

const DATE_FORMAT = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** An ISO 8601 UTC timestamp of the API, in the person's time zone. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date);
}
