import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import type { VulnerabilityGroup } from '../../core/api/api-types';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import {
  LevelCounts,
  VulnerabilitiesService,
  VulnerabilityFilters,
} from './vulnerabilities.service';
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

/**
 * Vulnerabilidades by group (pilot screen, FRO-10): `GET /api/vulnerabilities?view=vulnerability`, one row per CVE
 * and product with its highest final score, cursor pagination and the level counts of the filtered result.
 * Reuses the table, filter and card design of the Activos screen (`assets-view`).
 */
@Component({
  selector: 'app-vulnerabilities-page',
  imports: [
    FormsModule,
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
  styleUrl: './vulnerabilities-page.css',
})
export class VulnerabilitiesPage {
  private readonly service = inject(VulnerabilitiesService);

  readonly bannerIcon = LucideShieldAlert;
  readonly levels = LEVELS;
  readonly statuses = STATUSES;
  readonly levelLabels = LEVEL_LABELS;
  readonly statusLabels = STATUS_LABELS;
  readonly pageSizes = [10, 25, 50];

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

  readonly pager = new CursorPager<VulnerabilityGroup>((cursor) =>
    this.service.listGroups(this.filters(), cursor, this.pageSize()),
  );
  readonly counts = new AsyncState<LevelCounts>();

  readonly rows = computed(() =>
    this.pager.items().map((group) => ({
      ...group,
      levelLabel: LEVEL_LABELS[group.level],
      statusLabel: STATUS_LABELS[group.status],
      classificationLabel: CLASSIFICATION_LABELS[group.classification],
      lastSeen: formatDateTime(group.last_seen),
      custodianList: group.custodians.join(', ') || '—',
    })),
  );

  readonly tableState = computed<ViewState | null>(() => {
    const status = this.pager.state.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.rows().length ? null : 'empty';
  });

  readonly hasFilters = computed(() =>
    Object.values(this.filters()).some((value) => value !== null),
  );

  constructor() {
    this.refresh();
    inject(DestroyRef).onDestroy(() => {
      this.pager.state.cancel();
      this.counts.cancel();
    });
  }

  /** Reloads from the first page: a cursor is only valid with the filters it was issued for. */
  refresh(): void {
    this.pager.first();
    this.counts.run(this.service.levelCounts(this.filters()));
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
    this.pager.first();
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
