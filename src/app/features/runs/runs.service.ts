import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient, ApiQuery, ApiSchema } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';
import type { Run } from './run-labels';

export type RunFilters = Pick<ApiQuery<'/api/runs'>, 'kind' | 'status' | 'date_from' | 'date_to'>;
export type TelemetrySummary = ApiSchema<'TelemetrySummary'>;

/** Runs: the paged list (reader), launching a scan (analyst) and the run counts of the last 24 hours (reader). */
@Injectable({ providedIn: 'root' })
export class RunsService {
  private readonly api = inject(ApiClient);

  /** One page of runs, those not started yet first and then the newest (ARQ-04), with optional filters (HI-2). */
  list(filters: RunFilters, cursor: string | null, limit: number): Observable<CursorPage<Run>> {
    return this.api
      .get('/api/runs', { query: { ...filters, cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }

  /** Queues a simulated scan (FRO-19); the worker takes it and its progress streams from the run events. */
  launchScan(): Observable<Run> {
    return this.api.post('/api/scans', { body: { kind: 'scan' } });
  }

  /** Runs queued and running now, and those that ended well or with an error in the last 24 hours (AG-9). */
  summary(): Observable<TelemetrySummary> {
    return this.api.get('/api/telemetry/summary', { query: { window: '24h' } });
  }
}
