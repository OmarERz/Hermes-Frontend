import { NEVER, of, throwError } from 'rxjs';
import { AsyncState } from '../../shared/async-state';
import { CursorPager } from '../../shared/cursor-pager';
import { loadState, pagerState } from './view-state';

describe('view state', () => {
  it('reads a load as loading, error or its content', () => {
    const state = new AsyncState<number>();
    expect(loadState(state)).toBe('loading');
    state.run(NEVER);
    expect(loadState(state)).toBe('loading');
    state.run(throwError(() => new Error('boom')));
    expect(loadState(state)).toBe('error');
    state.run(of(1));
    expect(loadState(state)).toBeNull();
  });

  it('reads an empty page as empty', () => {
    const empty = new CursorPager<number>(() => of({ items: [], nextCursor: null }));
    expect(pagerState(empty)).toBe('loading');
    empty.first();
    expect(pagerState(empty)).toBe('empty');
    const full = new CursorPager<number>(() => of({ items: [1], nextCursor: null }));
    full.first();
    expect(pagerState(full)).toBeNull();
  });
});
