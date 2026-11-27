import type { ChipTone } from './chip';
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

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});
const SHORT_DATE_YEAR_FORMAT = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * The same timestamp for a table cell (F19.5, G14): without the year when it is the current one («27 nov, 4:09
 * p.m.»), same clock as formatDateTime. The cell keeps the full date in its title.
 */
export function formatShortDateTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const format =
    date.getFullYear() === now.getFullYear() ? SHORT_DATE_FORMAT : SHORT_DATE_YEAR_FORMAT;
  return format.format(date);
}

/** Chip tone of each finding status (G10: the semantic colours, in the shared chip). */
export const STATUS_TONES: Record<FindingStatus, ChipTone> = {
  new: 'violet',
  persistent: 'warning',
  reopened: 'danger',
  fixed: 'success',
  no_data: 'neutral',
};

/**
 * Criticality of an asset in iTop (VDE-2). The API gives it as text (`high`, `medium`, `low`); a value this table
 * does not know is shown as it comes, in a neutral chip.
 */
const CRITICALITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
  unknown: 'Sin dato',
};

export function criticalityLabel(value: string | null | undefined): string {
  if (!value) return 'Sin dato';
  return CRITICALITY_LABELS[value] ?? value;
}

export function criticalityTone(value: string | null | undefined): ChipTone {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'neutral';
}
