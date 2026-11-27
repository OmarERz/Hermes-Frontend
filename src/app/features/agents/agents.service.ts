import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient, ApiQuery, ApiSchema } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';
import type { TelemetryWindow } from './agent-labels';

export type TelemetrySummary = ApiSchema<'TelemetrySummary'>;
export type AgentTelemetry = ApiSchema<'AgentTelemetry'>;
export type TelemetryDaily = ApiSchema<'TelemetryDaily'>;
export type TelemetryDay = ApiSchema<'TelemetryDay'>;
export type ReasonUsage = ApiSchema<'ReasonUsage'>;
export type LlmReview = ApiSchema<'LlmReviewEntry'>;
export type TicketSummary = ApiSchema<'TicketSummary'>;
export type Run = ApiSchema<'Run'>;
export type MetricsDashboard = ApiSchema<'MetricsDashboard'>;
export type Metric = ApiSchema<'Metric'>;

export type ReviewFilters = Pick<
  ApiQuery<'/api/telemetry/reviews'>,
  'agent' | 'status' | 'date_from' | 'date_to'
>;
function toPage<T>(page: { items: T[]; next_cursor?: string | null }): CursorPage<T> {
  return { items: page.items, nextCursor: page.next_cursor ?? null };
}

/**
 * Reads of the agents screens (all role reader): telemetry of the AI agents and the runs, the LLM review log, the
 * ticket summary, the last run and the metrics board. Only metadata: no route returns prompts, packages or raw
 * calls (X-2).
 */
@Injectable({ providedIn: 'root' })
export class AgentsService {
  private readonly api = inject(ApiClient);

  summary(window: TelemetryWindow): Observable<TelemetrySummary> {
    return this.api.get('/api/telemetry/summary', { query: { window } });
  }

  /** One point per UTC day, oldest first, zero-filled. */
  daily(days: number): Observable<TelemetryDaily> {
    return this.api.get('/api/telemetry/daily', { query: { days } });
  }

  reviews(
    filters: ReviewFilters,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<LlmReview>> {
    return this.api
      .get('/api/telemetry/reviews', { query: { ...filters, cursor, limit } })
      .pipe(map(toPage));
  }

  ticketSummary(): Observable<TicketSummary> {
    return this.api.get('/api/tickets/summary');
  }

  /** The run the API lists first: a queued one, else the most recent; null when there is none. */
  latestRun(): Observable<Run | null> {
    return this.api
      .get('/api/runs', { query: { limit: 1 } })
      .pipe(map((page) => page.items[0] ?? null));
  }

  metrics(): Observable<MetricsDashboard> {
    return this.api.get('/api/metrics');
  }
}
