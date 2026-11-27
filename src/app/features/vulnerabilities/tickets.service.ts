import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient, ApiSchema } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';

export type Ticket = ApiSchema<'Ticket'>;
export type ThreatAlert = ApiSchema<'Alert'>;

/** iTop tickets created by Hermes and threat alerts (role reader). */
@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly api = inject(ApiClient);

  /** One page of tickets, optionally of one iTop urgency (1 critical to 4 low). */
  listTickets(
    urgency: number | null,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<Ticket>> {
    return this.api
      .get('/api/tickets', { query: { urgency, cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }

  /** One page of threat alerts (R2, R3 or inferred). */
  listAlerts(cursor: string | null, limit: number): Observable<CursorPage<ThreatAlert>> {
    return this.api
      .get('/api/alerts', { query: { cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }
}
