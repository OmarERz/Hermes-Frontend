import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideClipboardList,
  LucideDynamicIcon,
  LucideGlobe,
  LucideLayers,
  LucideLock,
  LucideRefreshCw,
  LucideUser,
  LucideUsers,
} from '@lucide/angular';
import type { LucideIconInput } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { ACTION_ROLES } from '../../core/auth/roles';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { ItopLink } from '../../shared/itop-links';
import { CpeMappingDialog, MappingTarget } from './cpe-mapping-dialog';
import { InventoryPending, InventoryService, Mapping, PendingItem } from './inventory.service';
import { viewState } from './inventory-view';
import { pendingCount, pendingItemId, PendingKind } from './pending-counts';

interface PendingSection {
  kind: PendingKind;
  title: string;
  /** Short name of the summary card. */
  card: string;
  hint: string;
  icon: LucideIconInput;
  software: boolean;
  /** Shown only when it has items (`outside_delivery_model` is not modelled yet: always empty). */
  onlyWithItems?: boolean;
}

const SECTIONS: readonly PendingSection[] = [
  {
    kind: 'software_without_cpe',
    title: 'Software sin CPE',
    card: 'Software sin CPE',
    hint: 'Sin CPE, Hermes no puede buscar sus vulnerabilidades. Un analista o un administrador le asigna uno aquí.',
    icon: LucideLayers,
    software: true,
  },
  {
    kind: 'without_classification',
    title: 'Activos sin clasificación',
    card: 'Sin clasificación',
    hint: 'Sus vulnerabilidades se evalúan con un contexto neutro hasta que iTop tenga su clasificación.',
    icon: LucideLock,
    software: false,
  },
  {
    kind: 'without_exposure',
    title: 'Activos sin dato de exposición',
    card: 'Sin exposición',
    hint: 'iTop no dice si el activo está expuesto a internet.',
    icon: LucideGlobe,
    software: false,
  },
  {
    kind: 'without_owner',
    title: 'Activos sin responsable',
    card: 'Sin responsable',
    hint: 'iTop no tiene a la persona responsable del activo.',
    icon: LucideUser,
    software: false,
  },
  {
    kind: 'without_custodian',
    title: 'Activos sin custodio',
    card: 'Sin custodio',
    hint: 'Sus tickets van al equipo custodio por defecto.',
    icon: LucideUsers,
    software: false,
  },
  {
    kind: 'outside_delivery_model',
    title: 'Fuera del modelo de entrega',
    card: 'Fuera del modelo',
    hint: 'Activos que Hermes no puede atender con su modelo de entrega.',
    icon: LucideClipboardList,
    software: false,
    onlyWithItems: true,
  },
];

/**
 * Pendientes de inventario (FRO-17, ESC-03c, ESC-07): the single screen of what the inventory still lacks:
 * software without a CPE (which never produces findings) and CIs without classification, exposure, owner or
 * custodian. The CI data are fixed in iTop; the CPE of a product is mapped here by an analyst or an admin
 * (`ACTION_ROLES.mapCpe`), with the candidate search.
 */
@Component({
  selector: 'app-pending-inventory-page',
  imports: [
    RouterLink,
    BannerPagina,
    AsyncStateComponent,
    IfRoleDirective,
    ItopLink,
    CpeMappingDialog,
    LucideDynamicIcon,
    LucideRefreshCw,
  ],
  templateUrl: './pending-inventory.page.html',
  styleUrls: ['./inventory-chips.css', './pending-inventory.page.css'],
})
export class PendingInventoryPage {
  private readonly service = inject(InventoryService);

  readonly bannerIcon = LucideClipboardList;
  readonly mapRole = ACTION_ROLES.mapCpe;

  readonly pending = new AsyncState<InventoryPending>();
  readonly state = computed(() => viewState(this.pending));
  readonly mapping = signal<MappingTarget | null>(null);
  readonly notice = signal('');

  /** Sections with their items (each with its id) and counts; the optional ones only when they have any. */
  readonly sections = computed(() => {
    const value = this.pending.value();
    if (!value) return [];
    return SECTIONS.map((section) => ({
      ...section,
      ...pendingCount(value, section.kind),
      items: (value[section.kind] ?? []).map((item) => ({
        ...item,
        id: pendingItemId(item, section.software),
      })),
    })).filter((section) => !section.onlyWithItems || section.count > 0);
  });
  readonly total = computed(() => this.sections().reduce((sum, section) => sum + section.count, 0));

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => this.pending.cancel());
  }

  load(): void {
    this.pending.run(this.service.pending());
  }

  /** Maps a software item by its product id (the `{software}` of the mapping route). */
  openMapping(item: PendingItem): void {
    this.notice.set('');
    this.mapping.set({ id: pendingItemId(item, true), name: item.name, cpe: null });
  }

  mapped(mapping: Mapping): void {
    const name = this.mapping()?.name ?? 'el software';
    this.mapping.set(null);
    this.notice.set(
      `CPE guardado para ${name} (${mapping.cpe}). Hermes buscará sus vulnerabilidades en el siguiente escaneo.`,
    );
    this.load();
  }
}
