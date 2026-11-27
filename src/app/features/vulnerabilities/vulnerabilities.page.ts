import { Component, computed, DestroyRef, inject, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideCalendar,
  LucideChevronDown,
  LucideFlame,
  LucideFunnel,
  LucideGlobe,
  LucideLayers,
  LucideLock,
  LucideRefreshCw,
  LucideShieldAlert,
  LucideSlidersHorizontal,
  LucideTriangleAlert,
  LucideUser,
  LucideUsers,
} from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import { Chip } from '../../shared/chip';
import { KpiCard, kpiState } from '../../shared/kpi-card';
import { ScrollFade } from '../../shared/scroll-fade.directive';
import {
  AssetRisk,
  LevelCounts,
  VulnerabilitiesService,
  VulnerabilityBand,
  VulnerabilityFilters,
  VulnerabilityGroup,
} from './vulnerabilities.service';
import { VIEW_LABELS, VIEW_QUERY, viewFromQuery, VulnerabilityView } from './vulnerability-texts';
import {
  Classification,
  CLASSIFICATION_LABELS,
  FindingStatus,
  formatDateTime,
  formatShortDateTime,
  Level,
  LEVEL_LABELS,
  LEVELS,
  STATUS_LABELS,
  STATUS_TONES,
  STATUSES,
} from '../../shared/labels';

type YesNoFilter = '' | 'true' | 'false';

function yesNo(value: YesNoFilter): boolean | null {
  return value === '' ? null : value === 'true';
}

const CLASSIFICATIONS = Object.keys(CLASSIFICATION_LABELS) as Classification[];

/**
 * A day of the date filter (`YYYY-MM-DD`) as an instant of the API: its first or its last millisecond in the
 * person's time zone, the zone the table shows «Última vez vista» in. Both ends are included (`last_seen`).
 */
function dayBound(day: string, end: boolean): string | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!parts) return null;
  const [year, month, date] = [Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])];
  const moment = end
    ? new Date(year, month, date, 23, 59, 59, 999)
    : new Date(year, month, date, 0, 0, 0, 0);
  return moment.toISOString();
}

/** A row of the group table: a band header (criticality view) or a vulnerability group. */
type GroupTableRow =
  | { kind: 'band'; key: string; level: Level; count: number }
  | (GroupRowView & { kind: 'group'; key: string });

type GroupRowView = VulnerabilityGroup & {
  levelLabel: string;
  statusLabel: string;
  classificationLabel: string;
  lastSeen: string;
  /** The same date for the table cell: without the current year (the full one goes in its title). */
  lastSeenShort: string;
  custodianList: string;
};

function groupRow(group: VulnerabilityGroup, key: string): GroupTableRow {
  return {
    ...group,
    kind: 'group',
    key,
    levelLabel: LEVEL_LABELS[group.level],
    statusLabel: STATUS_LABELS[group.status],
    classificationLabel: CLASSIFICATION_LABELS[group.classification],
    lastSeen: formatDateTime(group.last_seen),
    lastSeenShort: formatShortDateTime(group.last_seen),
    custodianList: group.custodians.join(', ') || '—',
  };
}

/**
 * Vulnerabilidades (FRO-10): the three grouped views of `GET /api/vulnerabilities` (by vulnerability, by asset and
 * by criticality) with the same filters, cursor pagination and the level counts of the filtered result. The view
 * is kept in the URL (`?vista=`). Reuses the table, filter and card design of the Activos screen (`assets-view`).
 */
@Component({
  selector: 'app-vulnerabilities-page',
  imports: [
    FormsModule,
    RouterLink,
    BannerPagina,
    AsyncStateComponent,
    Chip,
    KpiCard,
    ScrollFade,
    LucideArrowLeft,
    LucideArrowRight,
    LucideCalendar,
    LucideChevronDown,
    LucideFlame,
    LucideFunnel,
    LucideGlobe,
    LucideLayers,
    LucideLock,
    LucideRefreshCw,
    LucideSlidersHorizontal,
    LucideTriangleAlert,
    LucideUser,
    LucideUsers,
  ],
  templateUrl: './vulnerabilities-page.html',
  styleUrls: ['./vulnerability-chips.css', './vulnerabilities-page.css'],
})
export class VulnerabilitiesPage {
  private readonly service = inject(VulnerabilitiesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly bannerIcon = LucideShieldAlert;
  readonly levelIcon = LucideTriangleAlert;
  readonly levels = LEVELS;
  readonly statuses = STATUSES;
  readonly levelLabels = LEVEL_LABELS;
  readonly statusLabels = STATUS_LABELS;
  readonly statusTones = STATUS_TONES;
  readonly classificationLabels = CLASSIFICATION_LABELS;
  readonly classifications = CLASSIFICATIONS;
  readonly views = Object.keys(VIEW_LABELS) as VulnerabilityView[];
  readonly viewLabels = VIEW_LABELS;
  readonly pageSizes = [10, 25, 50];

  readonly view = signal<VulnerabilityView>(
    viewFromQuery(this.route.snapshot.queryParamMap.get('vista')),
  );
  readonly band = signal<Level | ''>('');
  readonly status = signal<FindingStatus | ''>('');
  readonly inKev = signal<YesNoFilter>('');
  readonly exposed = signal<YesNoFilter>('');
  readonly classification = signal<Classification | ''>('');
  /** Owner and custodian of the asset: exact text, as the API compares them. */
  readonly owner = signal('');
  readonly custodian = signal('');
  /** Days (`YYYY-MM-DD`) that bound «Última vez vista». */
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly pageSize = signal(25);
  /** «Más filtros» shows the five filters past the first four (VUL-1); they apply also while hidden. */
  readonly moreOpen = signal(false);
  /** Filters behind «Más filtros» with a value: the button counts them while they are hidden. */
  readonly moreActive = computed(
    () =>
      [
        this.classification(),
        this.owner(),
        this.custodian(),
        this.dateFrom(),
        this.dateTo(),
      ].filter(Boolean).length,
  );

  readonly filters = computed<VulnerabilityFilters>(() => ({
    band: this.band() || null,
    status: this.status() || null,
    in_kev: yesNo(this.inKev()),
    exposed: yesNo(this.exposed()),
    classification: this.classification() || null,
    owner: this.owner() || null,
    custodian: this.custodian() || null,
    date_from: dayBound(this.dateFrom(), false),
    date_to: dayBound(this.dateTo(), true),
  }));

  readonly groupPager = new CursorPager<VulnerabilityGroup>((cursor) =>
    this.service.listGroups(this.filters(), cursor, this.pageSize()),
  );
  readonly assetPager = new CursorPager<AssetRisk>((cursor) =>
    this.service.listAssets(this.filters(), cursor, this.pageSize()),
  );
  readonly bandPager = new CursorPager<VulnerabilityBand>((cursor) =>
    this.service.listBands(this.filters(), cursor, this.pageSize()),
  );
  readonly counts = new AsyncState<LevelCounts>();
  readonly countState = computed(() => kpiState(this.counts.status()));

  /** The pager of the current view (each view pages with its own cursors). */
  readonly pager = computed<CursorPager<unknown>>(() => {
    switch (this.view()) {
      case 'asset':
        return this.assetPager;
      case 'criticality':
        return this.bandPager;
      default:
        return this.groupPager;
    }
  });

  /** Rows of the group table: groups (vulnerability view) or band headers with their groups (criticality). */
  readonly groupRows = computed<GroupTableRow[]>(() => {
    if (this.view() === 'criticality') {
      return this.bandPager.items().flatMap((band) => [
        {
          kind: 'band' as const,
          key: `band-${band.level}`,
          level: band.level,
          count: band.count,
        },
        ...band.groups.map((group) => groupRow(group, `${band.level}-${group.group_id}`)),
      ]);
    }
    return this.groupPager.items().map((group) => groupRow(group, group.group_id));
  });

  readonly assetRows = computed(() =>
    this.assetPager.items().map((asset) => ({
      ...asset,
      classificationLabel: CLASSIFICATION_LABELS[asset.classification],
      statusLabel: STATUS_LABELS[asset.status],
      lastSeen: formatDateTime(asset.last_seen),
      lastSeenShort: formatShortDateTime(asset.last_seen),
      levels: LEVELS.map((level) => ({
        level,
        label: LEVEL_LABELS[level],
        count: asset.findings_by_level[level] ?? 0,
      })).filter((item) => item.count > 0),
    })),
  );

  readonly rowCount = computed(() =>
    this.view() === 'asset'
      ? this.assetRows().length
      : this.groupRows().filter((row) => row.kind === 'group').length,
  );

  readonly tableState = computed<ViewState | null>(() => {
    const status = this.pager().state.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.rowCount() ? null : 'empty';
  });

  readonly hasFilters = computed(() =>
    Object.values(this.filters()).some((value) => value !== null),
  );

  readonly emptyText = computed(() => {
    if (this.hasFilters()) return 'No hay resultados que coincidan con los filtros.';
    return this.view() === 'asset'
      ? 'Aún no hay activos con vulnerabilidades.'
      : 'Aún no hay vulnerabilidades registradas.';
  });

  constructor() {
    this.refresh();
    // The view lives in the URL: a link or the section tab can change `?vista=` while the page is reused.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const view = viewFromQuery(params.get('vista'));
      if (view === this.view()) return;
      this.view.set(view);
      this.pager().first();
    });
    inject(DestroyRef).onDestroy(() => {
      for (const pager of [this.groupPager, this.assetPager, this.bandPager]) pager.state.cancel();
      this.counts.cancel();
    });
  }

  /** Reloads from the first page: a cursor is only valid with the view and filters it was issued for. */
  refresh(): void {
    this.pager().first();
    this.counts.run(this.service.levelCounts(this.filters()));
  }

  toggleMore(): void {
    this.moreOpen.update((open) => !open);
  }

  setView(view: VulnerabilityView): void {
    if (view === this.view()) return;
    this.view.set(view);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vista: view === 'vulnerability' ? null : VIEW_QUERY[view] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.pager().first();
  }

  setBand(value: Level | ''): void {
    this.setFilter(this.band, value);
  }

  setStatus(value: FindingStatus | ''): void {
    this.setFilter(this.status, value);
  }

  setInKev(value: YesNoFilter): void {
    this.setFilter(this.inKev, value);
  }

  setExposed(value: YesNoFilter): void {
    this.setFilter(this.exposed, value);
  }

  setClassification(value: Classification | ''): void {
    this.setFilter(this.classification, value);
  }

  setOwner(value: string): void {
    this.setFilter(this.owner, value.trim());
  }

  setCustodian(value: string): void {
    this.setFilter(this.custodian, value.trim());
  }

  setDateFrom(value: string): void {
    this.setFilter(this.dateFrom, value);
  }

  setDateTo(value: string): void {
    this.setFilter(this.dateTo, value);
  }

  setPageSize(value: number): void {
    this.pageSize.set(value);
    this.pager().first();
  }

  clearFilters(): void {
    for (const filter of [
      this.band,
      this.status,
      this.inKev,
      this.exposed,
      this.classification,
      this.owner,
      this.custodian,
      this.dateFrom,
      this.dateTo,
    ] as WritableSignal<string>[]) {
      filter.set('');
    }
    this.refresh();
  }

  /** A new filter value starts again from the first page (a cursor belongs to its filters) with new counts. */
  private setFilter<T>(filter: WritableSignal<T>, value: T): void {
    if (Object.is(filter(), value)) return;
    filter.set(value);
    this.refresh();
  }

  /** Groups of `level` in the current filtered result (read only while `counts` is ready). */
  levelCount(level: Level): number {
    return this.counts.value()?.[level] ?? 0;
  }
}
