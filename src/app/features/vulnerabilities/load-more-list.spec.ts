import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { CursorPage } from '../../shared/cursor-pager';
import { LoadMoreList } from './load-more-list';

describe('LoadMoreList', () => {
  it('appends each page with the cursor of the previous one until the last page', () => {
    const fetch = vi.fn((cursor: string | null) =>
      of<CursorPage<string>>(
        cursor === null
          ? { items: ['a', 'b'], nextCursor: 'c1' }
          : { items: ['c'], nextCursor: null },
      ),
    );
    const list = new LoadMoreList(fetch);
    list.first();
    expect(list.items()).toEqual(['a', 'b']);
    expect(list.hasMore()).toBe(true);
    list.more();
    expect(fetch).toHaveBeenLastCalledWith('c1');
    expect(list.items()).toEqual(['a', 'b', 'c']);
    expect(list.hasMore()).toBe(false);
    list.more();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the cursor after a failed page so the next click retries it', () => {
    const fetch = vi.fn<(cursor: string | null) => Observable<CursorPage<string>>>();
    fetch.mockReturnValueOnce(of({ items: ['a'], nextCursor: 'c1' }));
    fetch.mockReturnValueOnce(throwError(() => new ApiError(503, 'unavailable', 'No responde.')));
    fetch.mockReturnValueOnce(of({ items: ['b'], nextCursor: null }));
    const list = new LoadMoreList(fetch);
    list.first();
    list.more();
    expect(list.state.error()?.message).toBe('No responde.');
    expect(list.hasMore()).toBe(true);
    list.more();
    expect(fetch).toHaveBeenLastCalledWith('c1');
    expect(list.items()).toEqual(['a', 'b']);
  });

  it('asks for one page at a time and starts again from the first page', () => {
    const pending = new Subject<CursorPage<string>>();
    const fetch = vi.fn(() => pending.asObservable());
    const list = new LoadMoreList(fetch);
    list.first();
    pending.next({ items: ['a'], nextCursor: 'c1' });
    list.more();
    list.more();
    expect(fetch).toHaveBeenCalledTimes(2);
    list.cancel();
    expect(pending.observed).toBe(false);
    fetch.mockReturnValue(of({ items: ['z'], nextCursor: null }) as never);
    list.first();
    expect(list.items()).toEqual(['z']);
  });
});
