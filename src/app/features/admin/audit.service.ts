import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient, ApiQuery, ApiSchema } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';

export type AuditEntry = ApiSchema<'AuditEntry'>;
export type AuditFilters = Pick<
  ApiQuery<'/api/audit'>,
  'actor' | 'action' | 'date_from' | 'date_to'
>;

/** The audit trail (admin): changes made from the front and by the system, newest first, never the values. */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly api = inject(ApiClient);

  list(
    filters: AuditFilters,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<AuditEntry>> {
    return this.api
      .get('/api/audit', { query: { ...filters, cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }
}
