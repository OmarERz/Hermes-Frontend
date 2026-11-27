import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, Observable, reduce } from 'rxjs';
import { ApiBody, ApiClient } from '../../core/api/api-client';
import type { Source } from './source-labels';

/** Largest page the API serves (FRONTEND.md §5). */
const PAGE_SIZE = 200;
/** Safety stop: 20 pages of 200 sources is far beyond any installation. */
const MAX_PAGES = 20;

export type SourceChange = ApiBody<'/api/sources/{id}', 'patch'>;
export type NewSource = ApiBody<'/api/sources', 'post'>;

/**
 * Sources (FRO-16, D-041): `GET /api/sources` (reader), `PATCH /api/sources/{id}` (analyst switches a source on or
 * off; only an admin changes its level) and `POST /api/sources` (admin adds an own HTTPS feed, which enters as N4
 * and inactive). The backend enforces every rule; the screen only avoids offering what would fail.
 */
@Injectable({ providedIn: 'root' })
export class SourcesService {
  private readonly api = inject(ApiClient);

  /** Every source, in the API order (structural first). The list is short, but the route pages, so every page is read. */
  listAll(): Observable<Source[]> {
    const page = (cursor: string | null) =>
      this.api.get('/api/sources', { query: { limit: PAGE_SIZE, cursor } });
    return page(null).pipe(
      expand((result, index) =>
        result.next_cursor && index + 1 < MAX_PAGES ? page(result.next_cursor) : EMPTY,
      ),
      reduce((all: Source[], result) => [...all, ...result.items], []),
    );
  }

  update(id: string, change: SourceChange): Observable<Source> {
    return this.api.patch('/api/sources/{id}', { path: { id }, body: change });
  }

  create(source: NewSource): Observable<Source> {
    return this.api.post('/api/sources', { body: source });
  }
}
