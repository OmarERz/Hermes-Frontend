import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient, ApiSchema } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';

export type ErrorQueueItem = ApiSchema<'ErrorQueueItem'>;
export type ErrorKind = ErrorQueueItem['kind'];
export type ErrorStatus = ErrorQueueItem['status'];
export type NotificationEventRow = ApiSchema<'NotificationEventRow'>;

/** Spanish names of the error queue enums, from the OpenAPI descriptions of `ErrorQueueItem`. */
export const KIND_LABELS: Record<ErrorKind, string> = {
  notification: 'Notificación',
  itop: 'Escritura en iTop',
  llm_validation: 'Validación del LLM',
};

/**
 * What failed, in Spanish (COL-2): the notification event type, the iTop operation or the LLM component. A value this
 * table does not know is shown as the API gives it.
 */
export const COMPONENT_LABELS: Readonly<Record<string, string>> = {
  new_ticket: 'Ticket nuevo',
  level_up: 'Subió de nivel',
  reopened: 'Ticket reabierto',
  partially_fixed: 'Corregido en parte',
  fixed: 'Corregido',
  threat_alert: 'Alerta de amenaza',
  inferred_alert: 'Alerta inferida por la IA',
  create: 'Crear ticket',
  update: 'Actualizar ticket',
  comment: 'Comentario en el ticket',
  judge: 'Juez',
  cve_analyst: 'Analista de CVE',
  news_analyst: 'Analista de noticias',
};

export const STATUS_LABELS: Record<ErrorStatus, string> = {
  failed: 'Agotó sus reintentos',
  pending: 'Espera su próximo reintento',
  gave_up: 'Se dejó de reintentar',
};

/**
 * What the state of an item means for a person. A `pending` item is in this queue only when no run retries it any
 * more (no `next_attempt_at`): it waits for a person, not for a retry.
 */
export function statusText(item: Pick<ErrorQueueItem, 'status' | 'next_attempt_at'>): string {
  if (item.status === 'pending' && !item.next_attempt_at)
    return 'Pendiente, sin reintento programado';
  return (STATUS_LABELS as Record<string, string>)[item.status] ?? item.status;
}

/** True when a retry is scheduled for the item (only then it is not waiting for a person). */
export function retryScheduled(item: Pick<ErrorQueueItem, 'status' | 'next_attempt_at'>): boolean {
  return item.status === 'pending' && !!item.next_attempt_at;
}

export const ERROR_KINDS = Object.keys(KIND_LABELS) as ErrorKind[];

/** The error queue (FRO-18, admin) and the retry of a notification event (NOT-02). */
@Injectable({ providedIn: 'root' })
export class ErrorQueueService {
  private readonly api = inject(ApiClient);

  /** One page of failed items, newest first, of every origin or of one. */
  list(
    kind: ErrorKind | null,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<ErrorQueueItem>> {
    return this.api
      .get('/api/error-queue', { query: { kind, cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }

  /** Puts a notification event in error back in the queue with a fresh attempt budget. */
  retry(id: string): Observable<NotificationEventRow> {
    return this.api.post('/api/notifications/events/{id}/retry', { path: { id } });
  }
}
