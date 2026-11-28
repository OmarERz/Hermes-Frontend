import { Component, computed, DestroyRef, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideActivity,
  LucideArrowLeft,
  LucideArrowRight,
  LucideCalendar,
  LucideChevronDown,
  LucideFunnel,
  LucideGlobe,
  LucideLayers,
  LucideLock,
  LucideMonitor,
  LucideRefreshCw,
  LucideSearch,
  LucideShieldAlert,
  LucideTriangleAlert,
  LucideUser,
  LucideUsers,
} from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { APP_CONFIG } from '../../core/config/app-config';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import { ItopLink, safeExternalUrl } from '../../shared/itop-links';
import { Chip } from '../../shared/chip';
import { KpiCard, KpiState } from '../../shared/kpi-card';
import { ScrollFade } from '../../shared/scroll-fade.directive';
import {
  Classification,
  CLASSIFICATION_LABELS,
  criticalityTone,
  formatDateTime,
  LEVEL_LABELS,
} from '../../shared/labels';
import {
  CRITICALITIES,
  Criticality,
  CRITICALITY_LABELS,
  Exposure,
  EXPOSURE_LABELS,
  EXPOSURES,
  exposureLabel,
  HOST_CLASSES,
  itopClassLabel,
  plural,
  text,
} from './inventory-labels';
import {
  AssetFilters,
  InventoryAsset,
  InventoryService,
  InventorySummary,
} from './inventory.service';
import { shareRows, viewState } from './inventory-view';

type YesNoFilter = '' | 'true' | 'false';

function yesNo(value: YesNoFilter): boolean | null {
  return value === '' ? null : value === 'true';
}

const CLASSIFICATIONS = Object.keys(CLASSIFICATION_LABELS) as Classification[];

/**
 * Activos (AC-1 to AC-10, D-088): every live CI of the iTop inventory (`GET /api/inventory/assets`), with or
 * without findings, its iTop class, CPU, RAM, OS, owner and custodian, filters and cursor pagination; the totals
 * and distributions of `GET /api/inventory/summary`. Read only: a CI is created or changed in iTop («Crear en
 * iTop», «Ver en iTop»), never here (D-003). Keeps the prototype's Activos design (`assets-view`).
 */
@Component({
  selector: 'app-assets-page',
  imports: [
    FormsModule,
    RouterLink,
    BannerPagina,
    AsyncStateComponent,
    Chip,
    ItopLink,
    KpiCard,
    ScrollFade,
    LucideActivity,
    LucideArrowLeft,
    LucideArrowRight,
    LucideCalendar,
    LucideChevronDown,
    LucideFunnel,
    LucideGlobe,
    LucideLayers,
    LucideLock,
    LucideRefreshCw,
    LucideSearch,
    LucideShieldAlert,
    LucideTriangleAlert,
    LucideUser,
    LucideUsers,
  ],
  templateUrl: './assets.page.html',
  styleUrls: ['./inventory-chips.css', './assets.page.css'],
})
export class AssetsPage {
  private readonly service = inject(InventoryService);

  readonly bannerIcon = LucideMonitor;
  /** Icons of the indicator cards. */
  readonly kpiIcons = {
    total: LucideLayers,
    critical: LucideTriangleAlert,
    owners: LucideUsers,
    findings: LucideShieldAlert,
  };
  readonly criticalityTone = criticalityTone;
  readonly criticalities = CRITICALITIES;
  readonly criticalityLabels = CRITICALITY_LABELS;
  readonly classifications = CLASSIFICATIONS;
  readonly classificationLabels = CLASSIFICATION_LABELS;
  readonly levelLabels = LEVEL_LABELS;
  readonly hostClasses = HOST_CLASSES;
  readonly itopClassLabel = itopClassLabel;
  readonly text = text;
  readonly pageSizes = [10, 25, 50];
  /** The «Crear en iTop» link needs the iTop console of the runtime configuration. */
  readonly itopConfigured = !!safeExternalUrl(inject(APP_CONFIG).itopBaseUrl);

  readonly q = signal('');
  readonly itopClass = signal('');
  readonly criticality = signal<Criticality | ''>('');
  readonly exposed = signal<YesNoFilter>('');
  readonly classification = signal<Classification | ''>('');
  readonly withFindings = signal<YesNoFilter>('');
  /** Owner and custodian: exact text, as the API compares them. */
  readonly owner = signal('');
  readonly custodian = signal('');
  readonly pageSize = signal(25);
  readonly showInventory = signal(true);
  readonly createClass = signal<string>(HOST_CLASSES[0]);

  readonly filters = computed<AssetFilters>(() => ({
    q: this.q() || null,
    itop_class: this.itopClass() || null,
    criticality: this.criticality() || null,
    exposed: yesNo(this.exposed()),
    classification: this.classification() || null,
    with_findings: yesNo(this.withFindings()),
    owner: this.owner() || null,
    custodian: this.custodian() || null,
  }));
  readonly hasFilters = computed(() =>
    Object.values(this.filters()).some((value) => value !== null),
  );

  readonly pager = new CursorPager<InventoryAsset>((cursor) =>
    this.service.listAssets(this.filters(), cursor, this.pageSize()),
  );
  readonly summary = new AsyncState<InventorySummary>();

  readonly rows = computed(() =>
    this.pager.items().map((asset) => ({
      ...asset,
      classLabel: itopClassLabel(asset.itop_class),
      criticalityLabel: CRITICALITY_LABELS[asset.criticality],
      classificationLabel: CLASSIFICATION_LABELS[asset.classification],
      exposure: exposureLabel(asset.exposed),
      openLabel: plural(asset.open_findings, 'abierta', 'abiertas'),
    })),
  );
  readonly tableState = computed(() => viewState(this.pager.state, this.rows().length === 0));
  readonly emptyText = computed(() =>
    this.hasFilters()
      ? 'No hay activos que coincidan con los filtros.'
      : 'Aún no hay activos sincronizados desde iTop.',
  );

  readonly summaryState = computed(() => viewState(this.summary));
  /** The cards keep the last totals while they reload; before the first answer they load or say «Sin datos». */
  readonly totalsState = computed<KpiState>(() => {
    if (this.summary.value()) return 'ready';
    return this.summaryState() === 'error' ? 'error' : 'loading';
  });
  /** CIs of high criticality (the summary leaves out a criticality that no CI has). */
  readonly highCriticality = computed(() => this.summary.value()?.by_criticality['high'] ?? 0);
  /** Classes for the filter: the ones of the inventory, plus the selected one if it has no CI left. */
  readonly classOptions = computed(() => {
    const classes = Object.keys(this.summary.value()?.by_class ?? {});
    const selected = this.itopClass();
    if (selected && !classes.includes(selected)) classes.push(selected);
    return classes
      .map((value) => ({ value, label: itopClassLabel(value) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  });
  readonly classRows = computed(() =>
    shareRows(this.summary.value()?.by_class ?? {}, itopClassLabel),
  );
  readonly criticalityRows = computed(() =>
    shareRows<Criticality>(
      this.summary.value()?.by_criticality ?? {},
      (key) => CRITICALITY_LABELS[key],
      CRITICALITIES,
    ),
  );
  readonly exposureRows = computed(() =>
    shareRows<Exposure>(
      this.summary.value()?.by_exposure ?? {},
      (key) => EXPOSURE_LABELS[key],
      EXPOSURES,
    ),
  );
  readonly lastSync = computed(() => {
    const at = this.summary.value()?.last_sync_at;
    return at ? formatDateTime(at) : 'Sin sincronizar';
  });

  constructor() {
    this.refresh();
    inject(DestroyRef).onDestroy(() => {
      this.pager.state.cancel();
      this.summary.cancel();
    });
  }

  /** Reloads the list from its first page (a cursor belongs to its filters) and the totals. */
  refresh(): void {
    this.pager.first();
    this.summary.run(this.service.summary());
  }

  setQuery(value: string): void {
    this.setFilter(this.q, value.trim());
  }

  setItopClass(value: string): void {
    this.setFilter(this.itopClass, value);
  }

  setCriticality(value: Criticality | ''): void {
    this.setFilter(this.criticality, value);
  }

  setExposed(value: YesNoFilter): void {
    this.setFilter(this.exposed, value);
  }

  setClassification(value: Classification | ''): void {
    this.setFilter(this.classification, value);
  }

  setWithFindings(value: YesNoFilter): void {
    this.setFilter(this.withFindings, value);
  }

  setOwner(value: string): void {
    this.setFilter(this.owner, value.trim());
  }

  setCustodian(value: string): void {
    this.setFilter(this.custodian, value.trim());
  }

  setPageSize(value: number): void {
    this.pageSize.set(value);
    this.pager.first();
  }

  clearFilters(): void {
    for (const filter of [
      this.q,
      this.itopClass,
      this.criticality,
      this.exposed,
      this.classification,
      this.withFindings,
      this.owner,
      this.custodian,
    ] as WritableSignal<string>[]) {
      filter.set('');
    }
    this.pager.first();
  }

  /** A new filter value starts again from the first page: a cursor is only valid with its filters. */
  private setFilter<T>(filter: WritableSignal<T>, value: T): void {
    if (Object.is(filter(), value)) return;
    filter.set(value);
    this.pager.first();
  }
}
