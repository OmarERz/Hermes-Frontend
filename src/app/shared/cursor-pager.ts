import { computed, signal } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { toApiError } from '../core/api/api-error';
import { AsyncState } from './async-state';

/** One page of a cursor-paginated route: its items and the opaque cursor of the next page (null: last). */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Cursor pagination (FRONTEND.md §5): the cursor is opaque and signed, so it is passed back exactly as received,
 * only to the same route with the same filters. The pager remembers the cursors it has seen to go back, and an
 * `invalid_cursor` (400) sends it back to the first page.
 */
export class CursorPager<T> {
  readonly state = new AsyncState<CursorPage<T>>();
  readonly pageIndex = signal(0);
  readonly items = computed(() => this.state.value()?.items ?? []);
  readonly hasPrevious = computed(() => this.pageIndex() > 0);
  readonly hasNext = computed(
    () => this.state.status() === 'ready' && !!this.state.value()?.nextCursor,
  );

  private cursors: (string | null)[] = [null];

  constructor(private readonly fetchPage: (cursor: string | null) => Observable<CursorPage<T>>) {}

  /** Loads the first page (call it again when the filters change: cursors belong to their filters). */
  first(): void {
    this.cursors = [null];
    this.pageIndex.set(0);
    this.load();
  }

  next(): void {
    const next = this.state.value()?.nextCursor;
    if (!next || this.state.loading()) return;
    this.cursors = [...this.cursors.slice(0, this.pageIndex() + 1), next];
    this.pageIndex.update((index) => index + 1);
    this.load();
  }

  previous(): void {
    if (this.pageIndex() === 0 || this.state.loading()) return;
    this.pageIndex.update((index) => index - 1);
    this.load();
  }

  reload(): void {
    this.load();
  }

  private load(): void {
    const cursor = this.cursors[this.pageIndex()];
    this.state.run(
      this.fetchPage(cursor).pipe(
        catchError((error: unknown) => {
          const failure = toApiError(error);
          if (failure.code === 'invalid_cursor' && cursor !== null) {
            this.cursors = [null];
            this.pageIndex.set(0);
            return this.fetchPage(null);
          }
          return throwError(() => failure);
        }),
      ),
    );
  }
}
