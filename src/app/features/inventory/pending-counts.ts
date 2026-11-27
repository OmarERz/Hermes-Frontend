import type { InventoryPending, PendingItem } from './inventory.service';

/** The lists of `GET /api/pending/inventory` (`totals` is not a list). */
export type PendingKind = Exclude<keyof InventoryPending, 'totals'>;

/** Each list the API gives is at most this long, without paging (FRO-17). */
export const PENDING_PAGE = 200;

/** How many items of a kind there are, and whether its list shows them all. */
export interface PendingCount {
  /** The real number: the API total (`totals`, F18.6), or the list length without it. */
  count: number;
  /** Only without `totals`: the list reached PENDING_PAGE, so there are at least `count`. */
  atLeast: boolean;
  /** As people read it: «200+» only when `atLeast`. */
  countLabel: string;
  /** The list holds fewer items than there are (cut at PENDING_PAGE), or may (`atLeast`). */
  capped: boolean;
  /** What the cut list says, or empty when it shows everything. */
  cappedText: string;
}

/**
 * The count of one kind, for Pendientes de inventario and the setup wizard (paso 5). With `totals` the number is
 * exact and a longer total means the list was cut; a total below what the list holds never hides an item. Without
 * `totals` (a backend before F18.6) a full list only says «at least that many».
 */
export function pendingCount(pending: InventoryPending, kind: PendingKind): PendingCount {
  const shown = (pending[kind] ?? []).length;
  const total = pending.totals?.[kind];
  if (typeof total === 'number' && Number.isFinite(total)) {
    const count = Math.max(total, shown);
    const capped = shown < count;
    return {
      count,
      atLeast: false,
      countLabel: String(count),
      capped,
      cappedText: capped ? `Se muestran los primeros ${shown} de ${count}.` : '',
    };
  }
  const atLeast = shown >= PENDING_PAGE;
  return {
    count: shown,
    atLeast,
    countLabel: atLeast ? `${shown}+` : String(shown),
    capped: atLeast,
    cappedText: atLeast ? `Se muestran los primeros ${shown}; puede haber más.` : '',
  };
}

/** The id of a pending item: the product id for software (`software_product_id`, F18.6; `ci_id` before), else the CI. */
export function pendingItemId(item: PendingItem, software: boolean): string {
  return software ? (item.software_product_id ?? item.ci_id) : item.ci_id;
}
