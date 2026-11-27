import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient, ApiSchema } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';

export type ComparisonSummary = ApiSchema<'ComparisonSummary'>;
export type ComparisonRow = ApiSchema<'ComparisonRow'>;

/** Raw (CVSS only) versus processed (Hermes) comparison, D-039 (role reader). */
@Injectable({ providedIn: 'root' })
export class ComparisonService {
  private readonly api = inject(ApiClient);

  /** Reclassification matrix, funnel and indicators over the current findings. */
  summary(): Observable<ComparisonSummary> {
    return this.api.get('/api/comparison/summary');
  }

  /** One page of findings with raw, base, judge, final, Δ and its main cause. */
  rows(cursor: string | null, limit: number): Observable<CursorPage<ComparisonRow>> {
    return this.api
      .get('/api/comparison/table', { query: { cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }
}
