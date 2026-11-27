import type { AsyncState } from '../../shared/async-state';
import type { ViewState } from '../../shared/async-state.component';
import { percent } from './inventory-labels';

/** What a panel shows instead of its content while it loads or after it failed (null: the content, or «empty»). */
export function viewState(state: AsyncState<unknown>, empty = false): ViewState | null {
  const status = state.status();
  if (status === 'idle' || status === 'loading') return 'loading';
  if (status === 'error') return 'error';
  return empty ? 'empty' : null;
}

/** One bar of a distribution panel: its count and its share of the total. */
export interface ShareRow<K extends string = string> {
  key: K;
  label: string;
  total: number;
  percent: number;
}

/**
 * Rows of a distribution panel from a count per key: `keys` fixes the order (and shows zeros); without it, the keys
 * of `counts` from the largest count down. Shares are whole percents of the sum, as the API counts them.
 */
export function shareRows<K extends string>(
  counts: Partial<Record<K, number>>,
  label: (key: K) => string,
  keys?: readonly K[],
): ShareRow<K>[] {
  const entries = (keys ?? (Object.keys(counts) as K[])).map(
    (key) => [key, counts[key] ?? 0] as const,
  );
  if (!keys) entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const sum = entries.reduce((all, [, count]) => all + count, 0);
  return entries.map(([key, total]) => ({
    key,
    label: label(key),
    total,
    percent: percent(total, sum),
  }));
}

/** Triggers the download of a text file built in the browser (CSV export of what the screen already loaded). */
export function downloadText(
  fileName: string,
  content: string,
  type = 'text/csv;charset=utf-8',
): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}
