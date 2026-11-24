import { Observable, of, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { CursorPage, CursorPager } from './cursor-pager';

describe('CursorPager', () => {
  const pages: Record<string, CursorPage<string>> = {
    first: { items: ['a', 'b'], nextCursor: 'c2.sig' },
    'c2.sig': { items: ['c', 'd'], nextCursor: 'c3.sig' },
    'c3.sig': { items: ['e'], nextCursor: null },
  };
  let calls: (string | null)[];
  let fetchPage: (cursor: string | null) => Observable<CursorPage<string>>;

  beforeEach(() => {
    calls = [];
    fetchPage = (cursor) => {
      calls.push(cursor);
      return of(pages[cursor ?? 'first']);
    };
  });

  it('walks forward with next_cursor exactly as received and back with the cursors it saw', () => {
    const pager = new CursorPager(fetchPage);
    pager.first();
    expect(pager.items()).toEqual(['a', 'b']);
    expect(pager.hasPrevious()).toBe(false);
    expect(pager.hasNext()).toBe(true);

    pager.next();
    pager.next();
    expect(pager.items()).toEqual(['e']);
    expect(pager.pageIndex()).toBe(2);
    expect(pager.hasNext()).toBe(false);

    pager.previous();
    expect(pager.items()).toEqual(['c', 'd']);
    expect(calls).toEqual([null, 'c2.sig', 'c3.sig', 'c2.sig']);
  });

  it('does nothing past the last page or before the first one', () => {
    const pager = new CursorPager(fetchPage);
    pager.first();
    pager.previous();
    pager.next();
    pager.next();
    pager.next();
    expect(calls).toEqual([null, 'c2.sig', 'c3.sig']);
  });

  it('goes back to the first page when the cursor is rejected as invalid', () => {
    const invalid = new ApiError(400, 'invalid_cursor', 'El cursor no es válido.');
    const pager = new CursorPager<string>((cursor) => {
      calls.push(cursor);
      return cursor === 'c2.sig' ? throwError(() => invalid) : of(pages[cursor ?? 'first']);
    });
    pager.first();
    pager.next();
    expect(calls).toEqual([null, 'c2.sig', null]);
    expect(pager.pageIndex()).toBe(0);
    expect(pager.items()).toEqual(['a', 'b']);
    expect(pager.state.status()).toBe('ready');
  });

  it('keeps any other error for the screen', () => {
    const pager = new CursorPager<string>(() =>
      throwError(() => new ApiError(403, 'forbidden', 'No tienes permiso.')),
    );
    pager.first();
    expect(pager.state.status()).toBe('error');
    expect(pager.state.error()?.code).toBe('forbidden');
    expect(pager.hasNext()).toBe(false);
  });
});
