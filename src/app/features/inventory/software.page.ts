import { Component, computed, DestroyRef, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideActivity,
  LucideArrowLeft,
  LucideArrowRight,
  LucideChartColumn,
  LucideChevronDown,
  LucideDownload,
  LucideFileCheck,
  LucideLayers,
  LucideRefreshCw,
  LucideSearch,
  LucideTriangleAlert,
} from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { GraficoDashboard } from '../../componentes/grafico-dashboard/grafico-dashboard';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { ACTION_ROLES } from '../../core/auth/roles';
import { APP_CONFIG } from '../../core/config/app-config';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { Chip } from '../../shared/chip';
import { toCsv } from '../../shared/csv';
import { ColumnsToggle } from '../../shared/columns-toggle';
import { CursorPager } from '../../shared/cursor-pager';
import { ItopLink, safeExternalUrl } from '../../shared/itop-links';
import { LEVEL_LABELS, LEVELS, type Level } from '../../shared/labels';
import { ScrollFade } from '../../shared/scroll-fade.directive';
import { CpeMappingDialog, MappingTarget } from './cpe-mapping-dialog';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  cpeParts,
  INSTALL_STATUS_LABELS,
  INSTALL_STATUS_TONES,
  INSTALL_STATUSES,
  plural,
  type SoftwareCategory,
} from './inventory-labels';
import {
  Catalogue,
  InventoryService,
  InventorySummary,
  LevelCounts,
  Mapping,
  SoftwareFilters,
  SoftwareItem,
} from './inventory.service';
import { downloadText, viewState } from './inventory-view';
import {
  catalogueTotals,
  chartHasData,
  CHART_TITLES,
  CHARTS,
  LEVEL_COLORS,
  PRIORITY_LABELS,
  SoftwareChart,
  softwareChart,
} from './software-charts';

type YesNoFilter = '' | 'true' | 'false';

function yesNo(value: YesNoFilter): boolean | null {
  return value === '' ? null : value === 'true';
}

/**
 * Software (ST-1, ST-4, ST-6, D-088): the catalogue of the software installed on live CIs
 * (`GET /api/inventory/software`), with its iTop categories, versions, installations by status, licences, CPE and
 * open vulnerabilities; filters (category included) and cursor pagination. The cards come from the inventory
 * summary and the panels add up every product of the catalogue. Analysts and admins map a product to a CPE
 * (`ACTION_ROLES.mapCpe`). Keeps the prototype's «Stack tecnológico» design (`stack-view`); the software itself is
 * registered in iTop.
 */
@Component({
  selector: 'app-software-page',
  imports: [
    FormsModule,
    BannerPagina,
    GraficoDashboard,
    AsyncStateComponent,
    Chip,
    ColumnsToggle,
    ScrollFade,
    IfRoleDirective,
    ItopLink,
    CpeMappingDialog,
    LucideActivity,
    LucideArrowLeft,
    LucideArrowRight,
    LucideChartColumn,
    LucideChevronDown,
    LucideDownload,
    LucideFileCheck,
    LucideLayers,
    LucideRefreshCw,
    LucideSearch,
    LucideTriangleAlert,
  ],
  templateUrl: './software.page.html',
  styleUrls: ['./inventory-chips.css', './software.page.css'],
})
export class SoftwarePage {
  private readonly service = inject(InventoryService);

  readonly bannerIcon = LucideLayers;
  readonly categories = CATEGORIES;
  readonly categoryLabels = CATEGORY_LABELS;
  readonly statuses = INSTALL_STATUSES;
  readonly statusLabels = INSTALL_STATUS_LABELS;
  readonly levels = LEVELS;
  readonly levelLabels = LEVEL_LABELS;
  readonly stateTones = INSTALL_STATUS_TONES;
  readonly charts = CHARTS;
  readonly chartTitles = CHART_TITLES;
  readonly mapRole = ACTION_ROLES.mapCpe;
  readonly pageSizes = [10, 25, 50];
  readonly itopConfigured = !!safeExternalUrl(inject(APP_CONFIG).itopBaseUrl);

  readonly q = signal('');
  readonly category = signal<SoftwareCategory | ''>('');
  readonly hasCpe = signal<YesNoFilter>('');
  readonly worstLevel = signal<Level | ''>('');
  readonly withVulnerabilities = signal<YesNoFilter>('');
  readonly pageSize = signal(25);
  readonly chart = signal<SoftwareChart>('category');
  /** «Todas las columnas»: categories, states and licences wait for a wide table (src/styles/tables.css). */
  readonly allColumns = signal(false);

  readonly filters = computed<SoftwareFilters>(() => ({
    q: this.q() || null,
    category: this.category() || null,
    has_cpe: yesNo(this.hasCpe()),
    worst_level: this.worstLevel() || null,
    with_vulnerabilities: yesNo(this.withVulnerabilities()),
  }));
  readonly hasFilters = computed(() =>
    Object.values(this.filters()).some((value) => value !== null),
  );

  readonly pager = new CursorPager<SoftwareItem>((cursor) =>
    this.service.listSoftware(this.filters(), cursor, this.pageSize()),
  );
  readonly summary = new AsyncState<InventorySummary>();
  readonly catalogue = new AsyncState<Catalogue>();
  readonly mapping = signal<MappingTarget | null>(null);
  readonly notice = signal('');

  readonly rows = computed(() =>
    this.pager.items().map((item) => ({
      ...item,
      categoryLabels: (item.categories ?? []).map((key) => CATEGORY_LABELS[key]),
      statusCounts: INSTALL_STATUSES.map((key) => ({
        key,
        label: INSTALL_STATUS_LABELS[key],
        count: item.by_status?.[key] ?? 0,
      })).filter((status) => status.count > 0),
      licenceNames: (item.licences ?? []).map((licence) => licence.name),
      licensedShort: `${item.licensed_instances} de ${item.instances}`,
      assets: plural(item.ci_count, 'activo', 'activos'),
      openLabel: plural(item.open_vulnerabilities, 'abierta', 'abiertas'),
      cpeParts: cpeParts(item.cpe),
    })),
  );
  readonly tableState = computed(() => viewState(this.pager.state, this.rows().length === 0));
  readonly emptyText = computed(() =>
    this.hasFilters()
      ? 'No hay software que coincida con los filtros.'
      : 'Aún no hay software instalado en el inventario de iTop.',
  );

  readonly summaryState = computed(() => viewState(this.summary));
  readonly software = computed(() => this.summary.value()?.software ?? null);
  readonly withCritical = computed(() => {
    const health = this.software();
    return health ? health.total - health.without_critical : 0;
  });

  readonly catalogueState = computed(() => viewState(this.catalogue));
  readonly totals = computed(() => catalogueTotals(this.catalogue.value()?.items ?? []));
  /** Vulnerability groups per level of the whole inventory, for «Vulnerabilidades por prioridad». */
  readonly priority = new AsyncState<LevelCounts>();
  /** The panel waits for the data of the selected chart: the priority counts or the catalogue. */
  readonly chartState = computed(() =>
    this.chart() === 'priority' ? viewState(this.priority) : this.catalogueState(),
  );
  readonly chartOption = computed(() =>
    softwareChart(this.chart(), this.totals(), this.priority.value()),
  );
  readonly chartLabel = computed(() =>
    this.chart() === 'priority'
      ? 'Vulnerabilidades únicas por prioridad en el inventario'
      : `${CHART_TITLES[this.chart()]} del catálogo de software`,
  );
  readonly chartReady = computed(() =>
    chartHasData(this.chart(), this.totals(), this.priority.value()),
  );
  readonly priorityCounts = computed(() =>
    LEVELS.map((level) => ({
      level,
      label: PRIORITY_LABELS[level],
      color: LEVEL_COLORS[level],
      count: this.priority.value()?.[level] ?? 0,
    })),
  );

  constructor() {
    this.refresh();
    inject(DestroyRef).onDestroy(() => {
      this.pager.state.cancel();
      this.summary.cancel();
      this.catalogue.cancel();
      this.priority.cancel();
    });
  }

  /** Reloads the table from its first page, the summary cards and the catalogue totals. */
  refresh(): void {
    this.pager.first();
    this.summary.run(this.service.summary());
    this.loadCatalogue();
  }

  loadCatalogue(): void {
    this.catalogue.run(this.service.catalogue());
    this.priority.run(this.service.vulnerabilityCounts());
  }

  /** Retries what the selected chart waits for. */
  retryChart(): void {
    if (this.chart() === 'priority') this.priority.run(this.service.vulnerabilityCounts());
    else this.catalogue.run(this.service.catalogue());
  }

  setQuery(value: string): void {
    this.setFilter(this.q, value.trim());
  }

  setCategory(value: SoftwareCategory | ''): void {
    this.setFilter(this.category, value);
  }

  setHasCpe(value: YesNoFilter): void {
    this.setFilter(this.hasCpe, value);
  }

  setWorstLevel(value: Level | ''): void {
    this.setFilter(this.worstLevel, value);
  }

  setWithVulnerabilities(value: YesNoFilter): void {
    this.setFilter(this.withVulnerabilities, value);
  }

  setPageSize(value: number): void {
    this.pageSize.set(value);
    this.pager.first();
  }

  clearFilters(): void {
    for (const filter of [
      this.q,
      this.category,
      this.hasCpe,
      this.worstLevel,
      this.withVulnerabilities,
    ] as WritableSignal<string>[]) {
      filter.set('');
    }
    this.pager.first();
  }

  openMapping(item: SoftwareItem): void {
    this.notice.set('');
    this.mapping.set({ id: item.id, name: item.name, cpe: item.cpe });
  }

  mapped(mapping: Mapping): void {
    const name = this.mapping()?.name ?? 'el software';
    this.mapping.set(null);
    this.notice.set(
      `CPE guardado para ${name} (${mapping.cpe}). Hermes buscará sus vulnerabilidades en el siguiente escaneo.`,
    );
    this.refresh();
  }

  /** CSV of the whole catalogue (every page already read for the totals), safe against formula injection. */
  exportCsv(): void {
    const items = this.catalogue.value()?.items ?? [];
    const rows = items.map((item) => [
      item.name,
      (item.categories ?? []).map((key) => CATEGORY_LABELS[key]).join('; '),
      item.versions.join('; '),
      item.instances,
      item.ci_count,
      item.by_status?.['active'] ?? 0,
      item.by_status?.['inactive'] ?? 0,
      item.by_status?.['unknown'] ?? 0,
      (item.licences ?? []).map((licence) => licence.name).join('; '),
      item.licensed_instances,
      item.cpe ?? '',
      item.open_vulnerabilities,
      item.worst_level ? LEVEL_LABELS[item.worst_level] : '',
    ]);
    const header = [
      'Software',
      'Categorías',
      'Versiones',
      'Instalaciones',
      'Activos',
      'Activas',
      'Inactivas',
      'Sin estado',
      'Licencias',
      'Instalaciones con licencia',
      'CPE',
      'Vulnerabilidades abiertas',
      'Peor nivel',
    ];
    downloadText('software-inventario.csv', toCsv([header, ...rows]));
  }

  private setFilter<T>(filter: WritableSignal<T>, value: T): void {
    if (Object.is(filter(), value)) return;
    filter.set(value);
    this.pager.first();
  }
}
