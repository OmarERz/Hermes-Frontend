import { Component, computed, DestroyRef, inject } from '@angular/core';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { InventoryPending, SetupService } from './setup.service';

/** The lists of `GET /api/pending/inventory` (`totals` is not a list). */
type PendingKind = Exclude<keyof InventoryPending, 'totals'>;

/** The pendings of FRO-17, in the order of the Pendientes de inventario screen (the OpenAPI descriptions). */
export const PENDING_LABELS: Record<PendingKind, string> = {
  software_without_cpe: 'Software sin CPE',
  without_classification: 'Activos sin clasificación',
  without_exposure: 'Activos sin dato de exposición',
  without_owner: 'Activos sin responsable',
  without_custodian: 'Activos sin equipo custodio',
  outside_delivery_model: 'Activos fuera del modelo de entrega',
};

/** The API lists up to this many items of each kind: without `totals`, a full list means «this many or more». */
export const PENDING_LIMIT = 200;

/**
 * Kinds the API does not compute yet (it always answers an empty list): shown only once it sends items, so an empty
 * list never reads as «nothing pending».
 */
const NOT_COMPUTED: readonly PendingKind[] = ['outside_delivery_model'];

export interface PendingRow {
  kind: PendingKind;
  label: string;
  count: number;
  /** Only without `totals`: the API cut the list at its limit, so there are at least `count`. */
  capped: boolean;
}

/**
 * The count of each kind: the exact total of `totals` (F18.6), which counts past the 200 of each list; without it
 * (a backend before F18.6), the list length, «or more» when the list is full.
 */
export function pendingRows(pending: InventoryPending | null): PendingRow[] {
  return (Object.keys(PENDING_LABELS) as PendingKind[])
    .map((kind) => {
      const listed = pending?.[kind]?.length ?? 0;
      const total = pending?.totals?.[kind];
      const exact = typeof total === 'number' && Number.isFinite(total);
      const count = exact ? Math.max(total, listed) : listed;
      return { kind, label: PENDING_LABELS[kind], count, capped: !exact && count >= PENDING_LIMIT };
    })
    .filter((row) => row.count > 0 || !NOT_COMPUTED.includes(row.kind));
}

/** The total for people: «al menos» when a list reached the API limit. */
export function pendingTotal(rows: readonly PendingRow[]): string {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return 'El inventario no tiene pendientes.';
  const noun = total === 1 ? 'pendiente' : 'pendientes';
  return rows.some((row) => row.capped)
    ? `Al menos ${total} ${noun} en el inventario`
    : `${total} ${noun} en el inventario`;
}

/**
 * Paso 5 · Revisión del inventario (docs/13 §9, FRO-17): what `GET /api/pending/inventory` finds missing in the iTop
 * inventory, as counts (its `totals`; without them, a list cut at the API limit reads «200 o más»). The data is fixed
 * in iTop and the CPE mapping in Pendientes de inventario.
 */
@Component({
  selector: 'app-setup-inventory-step',
  imports: [AsyncStateComponent],
  template: `
    @switch (load.status()) {
      @case ('error') {
        <app-async-state state="error" [error]="load.error()" (retry)="reload()" />
      }
      @case ('ready') {
        <p class="step-count">{{ total() }}</p>
        <ul class="step-list pending-list">
          @for (row of rows(); track row.kind) {
            <li [attr.data-kind]="row.kind">
              <span class="item-copy"
                ><strong>{{ row.label }}</strong></span
              >
              <span class="item-number" [class.zero]="row.count === 0">{{
                row.capped ? row.count + ' o más' : row.count
              }}</span>
            </li>
          }
        </ul>
        <p class="step-hint">
          Hermes lee el inventario de iTop: los activos, sus dueños y su clasificación se corrigen
          en iTop; el CPE del software se asigna en Pendientes de inventario.
        </p>
      }
      @default {
        <app-async-state state="loading" loadingText="Leyendo los pendientes del inventario…" />
      }
    }
  `,
  styleUrl: './setup-step.css',
})
export class SetupInventoryStep {
  private readonly service = inject(SetupService);

  readonly load = new AsyncState<InventoryPending>();

  readonly rows = computed(() => pendingRows(this.load.value()));
  readonly total = computed(() => pendingTotal(this.rows()));

  constructor() {
    this.reload();
    inject(DestroyRef).onDestroy(() => this.load.cancel());
  }

  reload(): void {
    this.load.run(this.service.pendingInventory());
  }
}
