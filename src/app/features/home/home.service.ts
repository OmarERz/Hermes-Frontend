import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ApiSchema } from '../../core/api/api-client';

export type InventorySummary = ApiSchema<'InventorySummary'>;
export type TicketSummary = ApiSchema<'TicketSummary'>;
export type TelemetrySummary = ApiSchema<'TelemetrySummary'>;

/** Window of the success card on the start screen: a week is steadier than a day. */
export const HOME_WINDOW = '7d' satisfies TelemetrySummary['window'];

/** The three summaries behind the start screen cards (role reader). */
@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly api = inject(ApiClient);

  /** Totals of the iTop inventory (current CIs and their installed software). */
  inventorySummary(): Observable<InventorySummary> {
    return this.api.get('/api/inventory/summary');
  }

  /** Tickets by state, urgency and resolution. */
  ticketSummary(): Observable<TicketSummary> {
    return this.api.get('/api/tickets/summary');
  }

  /** Runs and AI agents over the start screen window. */
  telemetrySummary(): Observable<TelemetrySummary> {
    return this.api.get('/api/telemetry/summary', { query: { window: HOME_WINDOW } });
  }
}
