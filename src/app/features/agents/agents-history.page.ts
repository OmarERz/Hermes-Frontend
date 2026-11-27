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
import { FormsModule } from '@angular/forms';
import {
  LucideActivity,
  LucideArrowLeft,
  LucideArrowRight,
  LucideClock,
  LucideListFilter,
} from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import { formatDateTime } from '../../shared/labels';
import {
  AGENT_LABELS,
  HISTORY_STATUS_OPTIONS,
  HISTORY_TYPE_LABELS,
  HISTORY_TYPES,
  historyStatusLabel,
  HistoryType,
  labelOf,
  RUN_KIND_LABELS,
  TRIGGER_LABELS,
} from './agent-labels';
import { AgentsService, HistoryEvent, HistoryFilters } from './agents.service';
import { dayBoundary, formatDuration } from './formatting';
import { JudgeReview } from './judge-review';
import { TicketLog } from './ticket-log';
import { pagerState } from './view-state';

const PAGE_SIZE = 25;

/** Status options of the filter: those of the chosen type, or of every type (each once). */
export function statusOptions(type: HistoryType | ''): { value: string; label: string }[] {
  const values = type
    ? HISTORY_STATUS_OPTIONS[type]
    : [...new Set(HISTORY_TYPES.flatMap((each) => HISTORY_STATUS_OPTIONS[each]))];
  return values.map((value) => ({
    value,
    label: type
      ? historyStatusLabel(type, value)
      : value === 'applied'
        ? 'Aplicado'
        : historyStatusLabel(null, value),
  }));
}

/** One row of the timeline, already in Spanish. */
export function historyRow(event: HistoryEvent) {
  return {
    event,
    id: event.id,
    at: formatDateTime(event.at),
    type: labelOf(HISTORY_TYPE_LABELS, event.type),
    title: event.title,
    agent: labelOf(AGENT_LABELS, event.agent),
    status: historyStatusLabel(event.type, event.status),
    statusKey: event.status,
    actor: event.actor,
    trigger: labelOf(TRIGGER_LABELS, event.trigger),
    duration: event.type === 'config_change' ? '—' : formatDuration(event.duration_seconds),
  };
}

/** The facts of the selected event for the detail panel (only those that apply to its type). */
export function eventDetail(event: HistoryEvent): { term: string; value: string }[] {
  const facts = [
    { term: 'Tipo de evento', value: labelOf(HISTORY_TYPE_LABELS, event.type) },
    { term: 'Fecha y hora', value: formatDateTime(event.at) },
    { term: 'Estado final', value: historyStatusLabel(event.type, event.status) },
    { term: 'Quién registró', value: event.actor },
  ];
  if (event.type === 'run') {
    facts.push(
      { term: 'Tipo de corrida', value: labelOf(RUN_KIND_LABELS, event.run_kind) },
      { term: 'Motivo', value: labelOf(TRIGGER_LABELS, event.trigger) },
    );
  }
  if (event.agent) facts.push({ term: 'Agente', value: labelOf(AGENT_LABELS, event.agent) });
  if (event.type !== 'config_change') {
    facts.push({ term: 'Duración', value: formatDuration(event.duration_seconds) });
  }
  if (event.config_version !== null) {
    facts.push({ term: 'Versión de configuración', value: `Versión ${event.config_version}` });
  }
  facts.push({ term: 'Identificador', value: event.id });
  return facts;
}

/**
 * Historial: the prototype's agent history (same design: filters, table and detail panel) on the F18.1 timeline
 * `GET /api/history`: runs, LLM reviews and configuration changes in one list, newest first, with date, type and
 * final state filters and cursor pages (HI-1, HI-2, HI-5, HI-10). A judge review opens its decision, its accepted
 * and rejected reasons and the feedback people gave (HI-6 to HI-8); below, the ticket log with its ticket and action
 * filters (HI-4). The full audit trail stays admin only (`GET /api/audit`).
 */
@Component({
  selector: 'app-agents-history-page',
  imports: [
    FormsModule,
    BannerPagina,
    AsyncStateComponent,
    JudgeReview,
    TicketLog,
    LucideArrowLeft,
    LucideArrowRight,
    LucideClock,
    LucideListFilter,
  ],
  templateUrl: './agents-history.page.html',
  styleUrls: ['./agents-tables.css', './agents-history.page.css'],
})
export class AgentsHistoryPage {
  private readonly service = inject(AgentsService);
  private readonly injector = inject(Injector);
  private readonly detailPanel = viewChild<ElementRef<HTMLElement>>('detailPanel');
  private readonly detailHeading = viewChild<ElementRef<HTMLElement>>('detailHeading');
  /** The «Detalle» button that opened the panel: focus goes back to it when the panel closes. */
  private opener: HTMLElement | null = null;

  readonly bannerIcon = LucideActivity;
  readonly types = HISTORY_TYPES;
  readonly typeLabels = HISTORY_TYPE_LABELS;

  readonly type = signal<HistoryType | ''>('');
  readonly status = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly selected = signal<HistoryEvent | null>(null);

  readonly pager = new CursorPager<HistoryEvent>((cursor) =>
    this.service.history(this.filters(), cursor, PAGE_SIZE),
  );
  readonly state = computed(() => pagerState(this.pager));
  readonly rows = computed(() => this.pager.items().map(historyRow));
  readonly statuses = computed(() => statusOptions(this.type()));
  readonly filtered = computed(() => !!(this.type() || this.status() || this.from() || this.to()));
  readonly detail = computed(() => {
    const event = this.selected();
    return event ? eventDetail(event) : [];
  });

  constructor() {
    this.pager.first();
    inject(DestroyRef).onDestroy(() => this.pager.state.cancel());
  }

  filters(): HistoryFilters {
    return {
      type: this.type() || null,
      status: this.status() || null,
      date_from: dayBoundary(this.from(), 'from'),
      date_to: dayBoundary(this.to(), 'to'),
    };
  }

  /** A new type keeps the chosen state only if that type has it; every change starts from the first page. */
  setType(value: HistoryType | ''): void {
    this.type.set(value);
    if (this.status() && !statusOptions(value).some((option) => option.value === this.status())) {
      this.status.set('');
    }
    this.reload();
  }

  setStatus(value: string): void {
    this.status.set(value);
    this.reload();
  }

  setFrom(value: string): void {
    this.from.set(value);
    this.reload();
  }

  setTo(value: string): void {
    this.to.set(value);
    this.reload();
  }

  clear(): void {
    this.type.set('');
    this.status.set('');
    this.from.set('');
    this.to.set('');
    this.reload();
  }

  /**
   * Opens the detail of an event (HIS-2): beside the list from 1440 px, below it on narrower screens, where it is
   * scrolled into view once it is drawn (smoothly unless the person asked for reduced motion). Focus moves to its
   * heading, so the next Tab goes through the detail and not back through the table.
   */
  select(event: HistoryEvent, click?: Event): void {
    const button = click?.currentTarget;
    this.opener = button instanceof HTMLElement ? button : null;
    this.selected.set(event);
    afterNextRender(() => this.revealDetail(), { injector: this.injector });
  }

  /** Closes the detail and gives the focus back to the «Detalle» button that opened it, if it is still there. */
  closeDetail(): void {
    this.selected.set(null);
    const opener = this.opener;
    this.opener = null;
    if (opener?.isConnected) opener.focus();
  }

  private revealDetail(): void {
    this.detailHeading()?.nativeElement.focus({ preventScroll: true });
    const panel = this.detailPanel()?.nativeElement;
    if (!panel || typeof panel.scrollIntoView !== 'function') return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }

  isSelected(event: HistoryEvent): boolean {
    return this.selected()?.id === event.id;
  }

  /** The selected event belongs to the old list, so the detail closes with every new filter. */
  private reload(): void {
    this.selected.set(null);
    this.opener = null;
    this.pager.first();
  }
}
