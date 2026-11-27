import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideActivity,
  LucideCircleCheck,
  LucideCirclePause,
  LucideClock,
  LucideGauge,
  LucideHash,
  LucideLayers,
  LucidePlus,
  LucideRefreshCw,
  LucideRss,
  LucideShield,
  LucideSignal,
  LucideTag,
} from '@lucide/angular';
import { finalize, Observable, tap } from 'rxjs';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { ApiError, toApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { ACTION_ROLES } from '../../core/auth/roles';
import { SessionService } from '../../core/auth/session.service';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { KpiCard } from '../../shared/kpi-card';
import { ConfirmChangesDialog } from '../../shared/confirm-changes-dialog';
import { formatDateTime } from '../../shared/labels';
import { ScrollFade } from '../../shared/scroll-fade.directive';
import type { ChangeRow } from '../../shared/versioned-save';
import { AddSourceForm } from './add-source-form';
import { CarouselState } from './carousel-state';
import {
  capturedWithinDay,
  formatRefresh,
  HEALTH_LABELS,
  LEVEL_MEANINGS,
  levelsFor,
  refreshMinutes,
  Source,
  SOURCE_LEVELS,
  SOURCE_TYPES,
  SourceLevel,
  sourceText,
  SourceType,
  TYPE_LABELS,
} from './source-labels';
import { SourceChange, SourcesService } from './sources.service';

/** A source with everything the screen shows, already in Spanish. */
export interface SourceRow {
  source: Source;
  id: string;
  name: string;
  initials: string;
  typeLabel: string;
  levelMeaning: string;
  healthLabel: string;
  description: string | null;
  provider: string | null;
  refresh: string | null;
  lastCapture: string | null;
}

export interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

function toRow(source: Source): SourceRow {
  return {
    source,
    id: source.id,
    name: source.name,
    initials: source.name.trim().slice(0, 2).toUpperCase(),
    typeLabel: TYPE_LABELS[source.type],
    levelMeaning: LEVEL_MEANINGS[source.level],
    healthLabel: HEALTH_LABELS[source.health],
    description: sourceText(source, 'description'),
    provider: sourceText(source, 'provider'),
    refresh: formatRefresh(refreshMinutes(source)),
    lastCapture: source.last_capture ? formatDateTime(source.last_capture) : null,
  };
}

function countBy<K extends string>(keys: readonly K[], values: readonly K[]): Record<K, number> {
  return Object.fromEntries(
    keys.map((key) => [key, values.filter((value) => value === key).length]),
  ) as Record<K, number>;
}

/** Pixels a horizontal drag must travel before it counts as a swipe. */
const SWIPE_DISTANCE = 45;

/**
 * Fuentes (FRO-16, D-041, FE-1): the prototype's Feeds carousel over the real sources of `GET /api/sources`, with
 * their class, trust level N1 to N4, health and state, filtered by class or by level. Structural sources carry 🔒
 * and are never switched off; analysts and admins switch the optional ones on or off (`PATCH /api/sources/{id}`).
 * Admins also change a level (with confirmation) and add own HTTPS feeds (`POST /api/sources`).
 */
@Component({
  selector: 'app-sources-page',
  imports: [
    BannerPagina,
    AsyncStateComponent,
    ScrollFade,
    ConfirmChangesDialog,
    IfRoleDirective,
    AddSourceForm,
    KpiCard,
    LucidePlus,
    LucideActivity,
    LucideCircleCheck,
    LucideClock,
    LucideGauge,
    LucideHash,
    LucideLayers,
    LucideRefreshCw,
    LucideShield,
    LucideSignal,
    LucideTag,
  ],
  templateUrl: './sources-page.html',
  styleUrl: './sources-page.css',
})
export class SourcesPage {
  private readonly service = inject(SourcesService);
  private readonly destroyRef = inject(DestroyRef);
  readonly session = inject(SessionService);

  readonly bannerIcon = LucideRss;
  /** Icons of the indicator cards. */
  readonly kpiIcons = {
    total: LucideLayers,
    active: LucideCircleCheck,
    inactive: LucideCirclePause,
    captured: LucideRefreshCw,
  };
  readonly toggleRole = ACTION_ROLES.toggleSource;
  readonly types = SOURCE_TYPES;
  readonly levels = SOURCE_LEVELS;
  readonly typeLabels = TYPE_LABELS;

  readonly load = new AsyncState<Source[]>();
  /** The sources as last read or changed: a change replaces only its own source. */
  readonly sources = signal<Source[]>([]);
  private readonly loadedAt = signal(0);

  readonly typeFilter = signal<SourceType | ''>('');
  readonly levelFilter = signal<SourceLevel | ''>('');

  /** Sources being changed right now (their switch is disabled until the API answers). */
  readonly pending = signal<ReadonlySet<string>>(new Set());
  readonly notice = signal<Notice | null>(null);

  /** Level change waiting for the admin's confirmation (FRO-16: only an admin changes a level). */
  readonly levelRole: Role = 'admin';
  readonly levelChange = signal<{ source: Source; level: SourceLevel } | null>(null);
  readonly levelSaving = signal(false);
  readonly levelError = signal<ApiError | null>(null);
  readonly levelRows = computed<ChangeRow[]>(() => {
    const requested = this.levelChange();
    if (!requested) return [];
    const { source, level } = requested;
    return [
      {
        name: `Nivel de confianza de ${source.name}`,
        before: `${source.level} · ${LEVEL_MEANINGS[source.level]}`,
        after: `${level} · ${LEVEL_MEANINGS[level]}`,
      },
    ];
  });

  readonly addRole = ACTION_ROLES.addSource;
  readonly adding = signal(false);

  readonly rows = computed(() => this.sources().map(toRow));
  readonly filteredRows = computed(() =>
    this.rows().filter(
      (row) =>
        (!this.typeFilter() || row.source.type === this.typeFilter()) &&
        (!this.levelFilter() || row.source.level === this.levelFilter()),
    ),
  );
  readonly carousel = new CarouselState(this.filteredRows);

  private readonly ready = computed(() => this.load.status() === 'ready');
  readonly total = computed(() => (this.ready() ? this.sources().length : null));
  readonly activeCount = computed(() =>
    this.ready() ? this.sources().filter((source) => source.active).length : null,
  );
  readonly inactiveCount = computed(() =>
    this.ready() ? this.sources().filter((source) => !source.active).length : null,
  );
  readonly capturedToday = computed(() =>
    this.ready()
      ? this.sources().filter((source) => capturedWithinDay(source, this.loadedAt())).length
      : null,
  );

  /** Each class counted within the level filter, and each level within the class filter. */
  private readonly inLevel = computed(() =>
    this.sources().filter((source) => !this.levelFilter() || source.level === this.levelFilter()),
  );
  private readonly inType = computed(() =>
    this.sources().filter((source) => !this.typeFilter() || source.type === this.typeFilter()),
  );
  readonly typeCounts = computed(() =>
    countBy(
      SOURCE_TYPES,
      this.inLevel().map((source) => source.type),
    ),
  );
  readonly levelCounts = computed(() =>
    countBy(
      SOURCE_LEVELS,
      this.inType().map((source) => source.level),
    ),
  );
  readonly allTypesCount = computed(() => this.inLevel().length);
  readonly allLevelsCount = computed(() => this.inType().length);

  private readonly details = viewChild<ElementRef<HTMLElement>>('details');
  private pointerStart: { id: number; x: number } | null = null;
  private ignoreClicksUntil = 0;

  constructor() {
    this.reload();
    this.destroyRef.onDestroy(() => this.load.cancel());
  }

  reload(): void {
    this.load.run(
      this.service.listAll().pipe(
        tap((sources) => {
          this.loadedAt.set(Date.now());
          this.sources.set(sources);
        }),
      ),
    );
  }

  setTypeFilter(type: SourceType | ''): void {
    this.typeFilter.set(type);
    this.carousel.reset();
  }

  setLevelFilter(level: SourceLevel | ''): void {
    this.levelFilter.set(level);
    this.carousel.reset();
  }

  /** Shows a source of the health table in the carousel and in the details panel. */
  showDetails(row: SourceRow): void {
    this.carousel.select(row.id);
    this.details()?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  /** Centres the clicked card (ignored right after a swipe, which already moved the carousel). */
  selectCard(id: string, virtualIndex: number): void {
    if (Date.now() < this.ignoreClicksUntil) return;
    this.carousel.select(id, virtualIndex);
  }

  /**
   * Switches a source on or off. The switch stays on the server state until the API answers, so a refusal (a
   * structural source, a missing role) never leaves it showing a state the source does not have.
   */
  toggle(row: SourceRow, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLInputElement).checked = row.source.active;
    if (this.isPending(row.id)) return;
    this.notice.set(null);
    this.save(row.source, { active: !row.source.active }).subscribe({
      next: (saved) =>
        this.notify(saved.active ? `${saved.name} quedó activa.` : `${saved.name} quedó inactiva.`),
      error: (error: unknown) => this.notify(toApiError(error).message, 'error'),
    });
  }

  isPending(id: string): boolean {
    return this.pending().has(id);
  }

  /** The levels an admin may give this source (N1 only for structural ones). */
  levelOptions(source: Source): SourceLevel[] {
    return levelsFor(source);
  }

  /** Asks to confirm a new level; the select stays on the saved level until the change is saved. */
  askLevel(row: SourceRow, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const level = select.value as SourceLevel;
    select.value = row.source.level;
    if (level === row.source.level || this.isPending(row.id)) return;
    this.levelError.set(null);
    this.levelChange.set({ source: row.source, level });
  }

  confirmLevel(): void {
    const requested = this.levelChange();
    if (!requested || this.levelSaving()) return;
    this.levelSaving.set(true);
    this.levelError.set(null);
    this.notice.set(null);
    this.save(requested.source, { level: requested.level })
      .pipe(finalize(() => this.levelSaving.set(false)))
      .subscribe({
        next: (saved) => {
          this.levelChange.set(null);
          this.notify(`${saved.name} quedó en nivel ${saved.level}.`);
        },
        error: (error: unknown) => this.levelError.set(toApiError(error)),
      });
  }

  cancelLevel(): void {
    if (this.levelSaving()) return;
    this.levelChange.set(null);
    this.levelError.set(null);
  }

  /** A feed the admin just added: it shows up selected, with every filter cleared. */
  sourceAdded(source: Source): void {
    this.adding.set(false);
    this.replace(source);
    this.typeFilter.set('');
    this.levelFilter.set('');
    this.carousel.select(source.id);
    this.notify(
      `${source.name} se agregó con nivel ${source.level} e inactiva. Actívala cuando quieras que Hermes la lea.`,
    );
  }

  private notify(text: string, kind: Notice['kind'] = 'ok'): void {
    this.notice.set({ kind, text });
  }

  /** Sends one change of a source, marking it pending, and puts the saved source in the list. */
  private save(source: Source, change: SourceChange): Observable<Source> {
    this.setPending(source.id, true);
    return this.service.update(source.id, change).pipe(
      tap((saved) => this.replace(saved)),
      finalize(() => this.setPending(source.id, false)),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  /** Puts the saved source in place of the old one (or at the end, if it is new). */
  private replace(saved: Source): void {
    this.sources.update((sources) =>
      sources.some((source) => source.id === saved.id)
        ? sources.map((source) => (source.id === saved.id ? saved : source))
        : [...sources, saved],
    );
  }

  private setPending(id: string, on: boolean): void {
    this.pending.update((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Remembers where a gesture starts, without capturing the pointer, so a plain click still selects a card. */
  startDrag(event: PointerEvent): void {
    if (event.target instanceof Element && event.target.closest('.feed-toggle')) return;
    this.pointerStart = { id: event.pointerId, x: event.clientX };
  }

  /** Captures the pointer only once the movement is clearly a horizontal drag. */
  updateDrag(event: PointerEvent): void {
    if (!this.pointerStart || this.pointerStart.id !== event.pointerId) return;
    if (Math.abs(event.clientX - this.pointerStart.x) < SWIPE_DISTANCE) return;
    const stage = event.currentTarget as HTMLElement;
    if (!stage.hasPointerCapture(event.pointerId)) stage.setPointerCapture(event.pointerId);
  }

  endDrag(event: PointerEvent): void {
    if (!this.pointerStart || this.pointerStart.id !== event.pointerId) return;
    const distance = event.clientX - this.pointerStart.x;
    this.pointerStart = null;
    if (Math.abs(distance) < SWIPE_DISTANCE) return;
    this.ignoreClicksUntil = Date.now() + 350;
    this.carousel.move(distance > 0 ? -1 : 1);
  }

  /** Horizontal trackpad gestures move the carousel without scrolling the page. */
  wheel(event: WheelEvent): void {
    if (Math.abs(event.deltaX) < 18 || Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;
    event.preventDefault();
    this.carousel.move(event.deltaX > 0 ? 1 : -1);
  }
}
