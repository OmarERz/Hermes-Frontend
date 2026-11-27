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

export const STATUS_LABELS: Record<ErrorStatus, string> = {
  failed: 'Agotó sus reintentos',
  pending: 'Espera su próximo reintento',
  gave_up: 'Se dejó de reintentar',
};

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
