import { Component, computed, DestroyRef, inject } from '@angular/core';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { InventoryPending, SetupService } from './setup.service';

type PendingKind = keyof InventoryPending;

/** The pendings of FRO-17, in the order of the Pendientes de inventario screen (the OpenAPI descriptions). */
export const PENDING_LABELS: Record<PendingKind, string> = {
  software_without_cpe: 'Software sin CPE',
  without_classification: 'Activos sin clasificación',
  without_exposure: 'Activos sin dato de exposición',
  without_owner: 'Activos sin responsable',
  without_custodian: 'Activos sin equipo custodio',
  outside_delivery_model: 'Activos fuera del modelo de entrega',
};

/**
 * Paso 5 · Revisión del inventario (docs/13 §9, FRO-17): what `GET /api/pending/inventory` finds missing in the iTop
 * inventory, as counts. The data is fixed in iTop and the CPE mapping in Pendientes de inventario.
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
        <p class="step-count">
          {{
            total() === 0
              ? 'El inventario no tiene pendientes.'
              : total() + (total() === 1 ? ' pendiente' : ' pendientes') + ' en el inventario'
          }}
        </p>
        <ul class="step-list pending-list">
          @for (row of rows(); track row.kind) {
            <li [attr.data-kind]="row.kind">
              <span class="item-copy"
                ><strong>{{ row.label }}</strong></span
              >
              <span class="item-number" [class.zero]="row.count === 0">{{ row.count }}</span>
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

  readonly rows = computed(() => {
    const pending = this.load.value();
    return (Object.keys(PENDING_LABELS) as PendingKind[]).map((kind) => ({
      kind,
      label: PENDING_LABELS[kind],
      count: pending?.[kind]?.length ?? 0,
    }));
  });
  readonly total = computed(() => this.rows().reduce((sum, row) => sum + row.count, 0));

  constructor() {
    this.reload();
    inject(DestroyRef).onDestroy(() => this.load.cancel());
  }

  reload(): void {
    this.load.run(this.service.pendingInventory());
  }
}
