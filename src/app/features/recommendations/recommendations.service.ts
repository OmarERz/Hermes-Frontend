import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient, type ApiQuery } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';
import {
  parseLevelBands,
  type FeedbackEntry,
  type FeedbackRequest,
  type FeedbackResult,
  type LevelBands,
  type Recommendation,
} from './feedback';

/** Optional narrowing of the list: the timeline of one vulnerability group or of one CI (FRO-12). */
export type RecommendationScope = Pick<ApiQuery<'/api/recommendations'>, 'group_id' | 'ci_id'>;

/**
 * Data of the Recomendaciones screen: the recommendation history (role reader), its feedback and the feedback form
 * (`POST /api/feedback`, role analyst; the backend enforces it).
 */
@Injectable({ providedIn: 'root' })
export class RecommendationsService {
  private readonly api = inject(ApiClient);

  /** One page of evaluations, newest first. */
  list(
    scope: RecommendationScope,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<Recommendation>> {
    return this.api
      .get('/api/recommendations', { query: { ...scope, cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }

  /** One evaluation by id, for a direct link. */
  get(assessmentId: string): Observable<Recommendation> {
    return this.api.get('/api/recommendations/{assessment_id}', {
      path: { assessment_id: assessmentId },
    });
  }

  /** The feedback given to an evaluation, with the current one of each person marked `active`. */
  feedback(assessmentId: string): Observable<FeedbackEntry[]> {
    return this.api.get('/api/recommendations/{id}/feedback', { path: { id: assessmentId } });
  }

  send(request: FeedbackRequest): Observable<FeedbackResult> {
    return this.api.post('/api/feedback', { body: request });
  }

  /** The level bands of the current configuration, to give the level of the base score (RE-9). */
  levelBands(): Observable<LevelBands | null> {
    return this.api.get('/api/config').pipe(map((config) => parseLevelBands(config.values)));
  }
}
