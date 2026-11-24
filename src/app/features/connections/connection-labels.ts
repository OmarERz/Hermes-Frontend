import type { ApiSchema } from '../../core/api/api-client';
import { formatDateTime } from '../../shared/labels';

export type ConnectionStatus = ApiSchema<'ConnectionStatus'>;
export type ConnectionName = ConnectionStatus['name'];
export type ConnectionGroup = 'services' | 'sources';
export type ConnectionState = 'ok' | 'missing' | 'failing';

/** What each connection is for (the OpenAPI descriptions of `ConnectionStatus.name`) and where the page lists it. */
export const CONNECTION_INFO: Record<
  ConnectionName,
  { title: string; purpose: string; group: ConnectionGroup }
> = {
  itop: { title: 'iTop', purpose: 'CMDB y tickets de iTop', group: 'services' },
  deepseek: { title: 'DeepSeek', purpose: 'Juez y analistas de IA', group: 'services' },
  firebase: { title: 'Firebase', purpose: 'Inicio de sesión', group: 'services' },
  nvd: { title: 'NVD', purpose: 'Base de vulnerabilidades NVD', group: 'sources' },
  abusech: { title: 'abuse.ch', purpose: 'Indicadores de abuse.ch', group: 'sources' },
  ransomwarelive: {
    title: 'ransomware.live',
    purpose: 'Víctimas de ransomware.live',
    group: 'sources',
  },
};

/** The order of the page: services first, then the data sources. */
export const CONNECTION_NAMES = Object.keys(CONNECTION_INFO) as ConnectionName[];

export const STATE_LABELS: Record<ConnectionState, string> = {
  ok: 'Funciona',
  missing: 'Sin configurar',
  failing: 'Con falla',
};

/** Works, lacks a variable on the server, or fails (rejected key, no answer, unexpected answer). */
export function connectionState(status: ConnectionStatus): ConnectionState {
  if (status.ok) return 'ok';
  return status.missing_variable ? 'missing' : 'failing';
}

/** The generic message of the API (already in the output language); never a key or an error body (SEG-23). */
export function connectionDetail(status: ConnectionStatus): string {
  if (status.message) return status.message;
  if (status.missing_variable) return `Variable faltante: ${status.missing_variable}`;
  return status.ok ? 'Conexión correcta' : 'Sin detalle';
}

export function formatLatency(ms: number | null): string {
  return ms === null ? '—' : `${ms} ms`;
}

export function formatMoment(iso: string | null | undefined, never: string): string {
  return iso ? formatDateTime(iso) : never;
}
