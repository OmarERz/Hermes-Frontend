import type { ApiSchema } from '../../core/api/api-client';

export type Source = ApiSchema<'Source'>;
export type SourceType = Source['type'];
export type SourceLevel = Source['level'];
export type SourceHealth = Source['health'];
export type SourceKind = NonNullable<ApiSchema<'SourceCreate'>['kind']>;

/** Spanish names of the source enums (the OpenAPI descriptions). */
export const TYPE_LABELS: Record<SourceType, string> = {
  official: 'Oficial',
  research: 'Investigación',
  media: 'Medio',
  feed: 'Feed propio',
};

export const LEVEL_MEANINGS: Record<SourceLevel, string> = {
  N1: 'Oficial (máxima confianza)',
  N2: 'Investigación o proveedor reconocido',
  N3: 'Medios especializados',
  N4: 'Feed propio o sin verificar (mínima confianza)',
};

export const HEALTH_LABELS: Record<SourceHealth, string> = {
  ok: 'Responde bien',
  degraded: 'Responde con fallas',
  failing: 'No responde',
};

export const KIND_LABELS: Record<SourceKind, string> = {
  rss: 'Feed RSS',
  atom: 'Feed Atom',
  json: 'Documento JSON',
  csv: 'Archivo CSV',
  api: 'API',
};

export const SOURCE_TYPES = Object.keys(TYPE_LABELS) as SourceType[];
export const SOURCE_LEVELS = Object.keys(LEVEL_MEANINGS) as SourceLevel[];
export const SOURCE_KINDS = Object.keys(KIND_LABELS) as SourceKind[];

/** N1 is reserved for the structural (official) sources: the API refuses it for any other source. */
export function levelsFor(source: Pick<Source, 'structural'>): SourceLevel[] {
  return source.structural ? SOURCE_LEVELS : SOURCE_LEVELS.filter((level) => level !== 'N1');
}

/**
 * Catalogue fields that F18.1 adds to `Source` as optional (description, provider, refresh_interval_minutes;
 * docs/front/contrato-f18-1.md). They are not in the published contract yet, so they are read only when the API
 * sends them, and nothing is shown in their place when it does not.
 */
function optionalField(source: Source, key: string): unknown {
  return (source as unknown as Record<string, unknown>)[key];
}

export function sourceText(source: Source, key: 'description' | 'provider'): string | null {
  const value = optionalField(source, key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function refreshMinutes(source: Source): number | null {
  const value = optionalField(source, 'refresh_interval_minutes');
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/** «Cada hora», «Cada 24 horas», «Cada 15 minutos»… from the real refresh interval. */
export function formatRefresh(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes === 60) return 'Cada hora';
  if (minutes % 60 === 0) return `Cada ${minutes / 60} horas`;
  return minutes === 1 ? 'Cada minuto' : `Cada ${minutes} minutos`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether the last capture is within the 24 hours before `now` (a clock slightly ahead still counts). */
export function capturedWithinDay(source: Source, now: number): boolean {
  if (!source.last_capture) return false;
  const at = Date.parse(source.last_capture);
  return Number.isFinite(at) && now - at <= DAY_MS;
}
