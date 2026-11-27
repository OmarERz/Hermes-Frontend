import { signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AsyncState } from '../../shared/async-state';
import type { CursorPage } from '../../shared/cursor-pager';

/**
 * A list that grows page by page («Cargar más») with the cursors of the API, for pickers that must reach every
 * record. The cursor is opaque: it goes back exactly as received, to the same route. After a failed page the
 * cursor is kept, so «Cargar más» tries that page again.
 */
export class LoadMoreList<T> {
  readonly state = new AsyncState<CursorPage<T>>();
  readonly items = signal<T[]>([]);
  readonly hasMore = signal(false);

  private nextCursor: string | null = null;

  constructor(private readonly fetchPage: (cursor: string | null) => Observable<CursorPage<T>>) {}

  /** Starts again from the first page. */
  first(): void {
    this.items.set([]);
    this.nextCursor = null;
    this.hasMore.set(false);
    this.load(null);
  }

  /** Appends the next page, if there is one and no page is loading. */
  more(): void {
    if (!this.hasMore() || this.state.loading()) return;
    this.load(this.nextCursor);
  }

  cancel(): void {
    this.state.cancel();
  }

  private load(cursor: string | null): void {
    this.state.run(
      this.fetchPage(cursor).pipe(
        tap((page) => {
          this.items.update((items) => [...items, ...page.items]);
          this.nextCursor = page.nextCursor;
          this.hasMore.set(page.nextCursor !== null);
        }),
      ),
    );
  }
}
