import type { AsyncState } from '../../shared/async-state';
import type { ViewState } from '../../shared/async-state.component';
import type { CursorPager } from '../../shared/cursor-pager';

/** What a panel shows instead of its content while it loads or after it failed (null: the content). */
export function loadState(state: AsyncState<unknown>): ViewState | null {
  const status = state.status();
  if (status === 'ready') return null;
  return status === 'error' ? 'error' : 'loading';
}

/** The same for a paged table, which is also «empty» when its page has no rows. */
export function pagerState(pager: CursorPager<unknown>): ViewState | null {
  return loadState(pager.state) ?? (pager.items().length ? null : 'empty');
}
