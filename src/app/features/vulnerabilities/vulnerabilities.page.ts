import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideChevronDown,
  LucideFlame,
  LucideFunnel,
  LucideGlobe,
  LucideLayers,
  LucideRefreshCw,
  LucideShieldAlert,
  LucideTriangleAlert,
} from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
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
  CLASSIFICATION_LABELS,
  FindingStatus,
  formatDateTime,
  Level,
  LEVEL_LABELS,
  LEVELS,
  STATUS_LABELS,
  STATUSES,
} from '../../shared/labels';

type YesNoFilter = '' | 'true' | 'false';

function yesNo(value: YesNoFilter): boolean | null {
  return value === '' ? null : value === 'true';
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
    LucideArrowLeft,
    LucideArrowRight,
    LucideChevronDown,
    LucideFlame,
    LucideFunnel,
    LucideGlobe,
    LucideLayers,
    LucideRefreshCw,
    LucideTriangleAlert,
  ],
  templateUrl: './vulnerabilities-page.html',
  styleUrls: ['./vulnerability-chips.css', './vulnerabilities-page.css'],
})
export class VulnerabilitiesPage {
  private readonly service = inject(VulnerabilitiesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly bannerIcon = LucideShieldAlert;
  readonly levels = LEVELS;
  readonly statuses = STATUSES;
  readonly levelLabels = LEVEL_LABELS;
  readonly statusLabels = STATUS_LABELS;
  readonly classificationLabels = CLASSIFICATION_LABELS;
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
  readonly pageSize = signal(25);

  readonly filters = computed<VulnerabilityFilters>(() => ({
    band: this.band() || null,
    status: this.status() || null,
    in_kev: yesNo(this.inKev()),
    exposed: yesNo(this.exposed()),
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
    this.band.set(value);
    this.refresh();
  }

  setStatus(value: FindingStatus | ''): void {
    this.status.set(value);
    this.refresh();
  }

  setInKev(value: YesNoFilter): void {
    this.inKev.set(value);
    this.refresh();
  }

  setExposed(value: YesNoFilter): void {
    this.exposed.set(value);
    this.refresh();
  }

  setPageSize(value: number): void {
    this.pageSize.set(value);
    this.pager().first();
  }

  clearFilters(): void {
    this.band.set('');
    this.status.set('');
    this.inKev.set('');
    this.exposed.set('');
    this.refresh();
  }

  /** Groups of `level` in the current filtered result (read only while `counts` is ready). */
  levelCount(level: Level): number {
    return this.counts.value()?.[level] ?? 0;
  }
}
