import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideCalendar,
  LucideChevronDown,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideClock,
  LucideFunnel,
  LucideLayers,
  LucideLoader,
  LucidePlay,
  LucideRadar,
  LucideRefreshCw,
  LucideX,
} from '@lucide/angular';
import { finalize, Subscription } from 'rxjs';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { Chip } from '../../shared/chip';
import { KpiCard } from '../../shared/kpi-card';
import { ApiError, toApiError } from '../../core/api/api-error';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { ACTION_ROLES } from '../../core/auth/roles';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import { dayBound } from './day-bound';
import { RunEventsService, RunProgress } from './run-events';
import {
  fresher,
  isActive,
  KIND_LABELS,
  Run,
  RUN_KINDS,
  RUN_STATUSES,
  RunKind,
  RunStatus,
  RunView,
  STATUS_LABELS,
  STATUS_TONES,
  toRunView,
} from './run-labels';
import { RunFilters, RunsService, TelemetrySummary } from './runs.service';

const PAGE_SIZE = 25;
/** Runs read to find the open one again after its stream ends. */
const LOOKUP_SIZE = 50;

/** What the live follow of the selected run is doing. */
export type LiveState = 'idle' | 'live' | 'ended' | 'error';

export interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

type CountKey = 'runs_queued' | 'runs_running' | 'runs_succeeded' | 'runs_failed';

/**
 * Corridas (FRO-19, ARQ-04, ARQ-05): scans, news runs and recalculations from `GET /api/runs`, filtered by kind,
 * status and start date and paged by cursor, with the counts of the last 24 hours (`GET /api/telemetry/summary`).
 * Selecting a run opens its detail; while it is queued or running, its progress comes live from
 * `GET /api/runs/{id}/events` and, when the stream ends, the list is read again for the final state. Analysts and
 * admins launch a scan (`POST /api/scans`, ACTION_ROLES.launchScan). The API has no route to cancel a run, so the
 * screen offers none.
 */
@Component({
  selector: 'app-runs-page',
  imports: [
    BannerPagina,
    AsyncStateComponent,
    IfRoleDirective,
    Chip,
    KpiCard,
    LucideArrowLeft,
    LucideArrowRight,
    LucideCalendar,
    LucideChevronDown,
    LucideFunnel,
    LucideLayers,
    LucideLoader,
    LucidePlay,
    LucideRadar,
    LucideRefreshCw,
    LucideX,
  ],
  templateUrl: './runs-page.html',
  styleUrl: './runs-page.css',
})
export class RunsPage {
  private readonly service = inject(RunsService);
  private readonly runEvents = inject(RunEventsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly detailPanel = viewChild<ElementRef<HTMLElement>>('detailPanel');

  readonly bannerIcon = LucidePlay;
  /** Icons of the indicator cards. */
  readonly kpiIcons = {
    queued: LucideClock,
    running: LucideLoader,
    succeeded: LucideCircleCheck,
    failed: LucideCircleAlert,
  };
  readonly launchRole = ACTION_ROLES.launchScan;
  readonly kinds = RUN_KINDS;
  readonly statuses = RUN_STATUSES;
  readonly kindLabels = KIND_LABELS;
  readonly statusLabels = STATUS_LABELS;
  readonly statusTones = STATUS_TONES;

  readonly kind = signal<RunKind | ''>('');
  readonly status = signal<RunStatus | ''>('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly hasFilters = computed(
    () => !!(this.kind() || this.status() || this.dateFrom() || this.dateTo()),
  );
  private readonly filters = computed<RunFilters>(() => ({
    kind: this.kind() || null,
    status: this.status() || null,
    date_from: dayBound(this.dateFrom(), false),
    date_to: dayBound(this.dateTo(), true),
  }));

  readonly pager = new CursorPager<Run>((cursor) =>
    this.service.list(this.filters(), cursor, PAGE_SIZE),
  );
  readonly summary = new AsyncState<TelemetrySummary>();

  /** The run whose detail is open (kept even when the current page no longer lists it). */
  readonly selected = signal<Run | null>(null);
  readonly live = signal<RunProgress | null>(null);
  readonly liveState = signal<LiveState>('idle');
  readonly liveError = signal<ApiError | null>(null);
  private watching: Subscription | null = null;

  readonly launching = signal(false);
  readonly notice = signal<Notice | null>(null);

  readonly tableState = computed<ViewState | null>(() => {
    const status = this.pager.state.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.pager.items().length ? null : 'empty';
  });

  /** The listed runs; the selected one shows its live progress while it is followed. */
  readonly rows = computed<RunView[]>(() => {
    const live = this.liveFor(this.selected()?.id);
    return this.pager
      .items()
      .map((run) => toRunView(run, live && run.id === live.runId ? live : undefined));
  });

  /**
   * The open run, as the current page lists it when it is there, unless the kept copy already ended (read after the
   * stream ended, whatever the table filters), with its live progress while it is still active.
   */
  readonly detail = computed<RunView | null>(() => {
    const chosen = this.selected();
    if (!chosen) return null;
    const listed = this.pager.items().find((run) => run.id === chosen.id);
    return toRunView(fresher(listed, chosen), this.liveFor(chosen.id) ?? undefined);
  });

  readonly queued = computed(() => this.count('runs_queued'));
  readonly running = computed(() => this.count('runs_running'));
  readonly succeeded = computed(() => this.count('runs_succeeded'));
  readonly failed = computed(() => this.count('runs_failed'));

  constructor() {
    this.pager.first();
    this.summary.run(this.service.summary());
    this.destroyRef.onDestroy(() => {
      this.pager.state.cancel();
      this.summary.cancel();
      this.stopWatching();
    });
  }

  setKind(value: string): void {
    this.kind.set(value as RunKind | '');
    this.pager.first();
  }

  setStatus(value: string): void {
    this.status.set(value as RunStatus | '');
    this.pager.first();
  }

  setDateFrom(value: string): void {
    this.dateFrom.set(value);
    this.pager.first();
  }

  setDateTo(value: string): void {
    this.dateTo.set(value);
    this.pager.first();
  }

  clearFilters(): void {
    this.kind.set('');
    this.status.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.pager.first();
  }

  /** Reads the current page and the counts again. */
  refresh(): void {
    this.pager.reload();
    this.summary.run(this.service.summary());
  }

  /**
   * Opens the detail of a run (above the list, brought into view) and, while the run can still change, follows its
   * progress live.
   */
  select(run: Run): void {
    if (this.selected()?.id !== run.id || this.liveState() !== 'live') {
      this.stopWatching();
      this.selected.set(run);
      this.live.set(null);
      this.liveError.set(null);
      this.liveState.set('idle');
      if (isActive(run.status)) this.follow(run.id);
    }
    afterNextRender(
      () =>
        this.detailPanel()?.nativeElement.scrollIntoView?.({
          behavior: 'smooth',
          block: 'nearest',
        }),
      { injector: this.injector },
    );
  }

  closeDetail(): void {
    this.stopWatching();
    this.selected.set(null);
    this.live.set(null);
    this.liveError.set(null);
    this.liveState.set('idle');
  }

  /** Follows the open run again after the stream gave up. */
  followAgain(): void {
    const run = this.selected();
    if (run) this.follow(run.id);
  }

  /** Queues a scan and opens it, following its progress from the queue. */
  launchScan(): void {
    if (this.launching()) return;
    this.launching.set(true);
    this.notice.set(null);
    this.service
      .launchScan()
      .pipe(
        finalize(() => this.launching.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (run) => {
          this.notice.set({
            kind: 'ok',
            text: 'Escaneo en cola. El worker lo toma en unos segundos y su avance se ve en el detalle.',
          });
          this.select(run);
          // A run not started yet heads the list (ARQ-04): show the first page.
          this.pager.first();
          this.summary.run(this.service.summary());
        },
        error: (error: unknown) =>
          this.notice.set({ kind: 'error', text: toApiError(error).message }),
      });
  }

  private follow(runId: string): void {
    this.stopWatching();
    this.liveError.set(null);
    this.liveState.set('live');
    this.watching = this.runEvents.watch(runId).subscribe({
      next: (progress) => this.live.set(progress),
      complete: () => this.settle(runId, 'ended'),
      error: (error: unknown) => {
        this.liveError.set(toApiError(error));
        this.settle(runId, 'error');
      },
    });
  }

  /**
   * The stream is over: the list and the counts are read again, and the run itself is looked up apart from the
   * table filters (it may have left them, say «En ejecución»), so the detail gets its final status, end and duration.
   */
  private settle(runId: string, state: LiveState): void {
    this.watching = null;
    const run = this.selected();
    if (run?.id !== runId) return;
    this.liveState.set(state);
    this.refresh();
    this.lookUp(run, this.live()?.status ?? null);
  }

  /**
   * Reads one run again without a route for a single run: same kind and, once started, the same start instant (it
   * never changes); a run that was still queued is looked for among the newest of its kind with its final status.
   */
  private lookUp(run: Run, status: RunStatus | null): void {
    const started = run.started_at || null;
    const filters: RunFilters = started
      ? { kind: run.kind, date_from: started, date_to: started }
      : { kind: run.kind, status: status && !isActive(status) ? status : null };
    this.service
      .list(filters, null, LOOKUP_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const found = page.items.find((item) => item.id === run.id);
          if (found && this.selected()?.id === run.id) this.selected.set(found);
        },
        // The table and the stream already said what they could; the detail keeps that.
        error: () => undefined,
      });
  }

  private liveFor(runId: string | undefined): RunProgress | null {
    const live = this.live();
    return live && runId && live.runId === runId ? live : null;
  }

  private count(key: CountKey): number | null {
    const summary = this.summary.value();
    return this.summary.status() === 'ready' && summary ? summary[key] : null;
  }

  private stopWatching(): void {
    this.watching?.unsubscribe();
    this.watching = null;
  }
}
