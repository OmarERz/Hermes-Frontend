import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideFileClock,
  LucideListFilter,
} from '@lucide/angular';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import { formatDateTime, formatShortDateTime } from '../../shared/labels';
import { ColumnsToggle } from '../../shared/columns-toggle';
import { ScrollFade } from '../../shared/scroll-fade.directive';
import {
  Agent,
  AGENT_LABELS,
  AGENTS,
  labelOf,
  REVIEW_MODE_LABELS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUSES,
  ReviewStatus,
} from './agent-labels';
import { AgentsService, LlmReview, ReviewFilters } from './agents.service';
import { dayBoundary, formatCount, formatLatency, formatUsd } from './formatting';
import { pagerState } from './view-state';

const PAGE_SIZE = 25;

/** One row of the log, already in Spanish. */
export function reviewRow(review: LlmReview) {
  return {
    id: review.id,
    at: formatDateTime(review.created_at),
    /** The same date for the table cell: without the current year (the full one goes in its title). */
    atShort: formatShortDateTime(review.created_at),
    agent: labelOf(AGENT_LABELS, review.agent),
    mode: labelOf(REVIEW_MODE_LABELS, review.mode),
    model: review.model,
    status: labelOf(REVIEW_STATUS_LABELS, review.status),
    statusKey: review.status,
    attempts: formatCount(review.attempts),
    latency: formatLatency(review.latency_ms),
    tokens: `${formatCount(review.tokens_input)} / ${formatCount(review.tokens_output)}`,
    tokensDetail:
      `Entrada ${formatCount(review.tokens_input)} (caché ${formatCount(review.tokens_cached)}), ` +
      `salida ${formatCount(review.tokens_output)} (razonamiento ${formatCount(review.tokens_reasoning)})`,
    cost: formatUsd(review.cost_usd),
    reasons:
      review.agent === 'judge'
        ? `${formatCount(review.reasons_accepted)} aceptados · ${formatCount(review.reasons_rejected)} rechazados`
        : 'No aplica',
    secondReview: review.second_review,
    assessmentId: review.assessment_id,
  };
}

/**
 * «Revisiones de IA» (HI-3, AG telemetry): every LLM interaction of the three agents, newest first
 * (`GET /api/telemetry/reviews`), with agent, state and date filters and cursor pages. Only metadata (X-2): never a
 * prompt, a package or a raw call.
 */
@Component({
  selector: 'app-reviews-log',
  imports: [
    FormsModule,
    RouterLink,
    AsyncStateComponent,
    ColumnsToggle,
    ScrollFade,
    LucideArrowLeft,
    LucideArrowRight,
    LucideFileClock,
    LucideListFilter,
  ],
  templateUrl: './reviews-log.html',
  styleUrls: ['./agents-tables.css', './reviews-log.css'],
})
export class ReviewsLog {
  /** «Todas las columnas»: mode, model, attempts, tokens and cost, which have no detail of their own. */
  readonly allColumns = signal(false);
  private readonly service = inject(AgentsService);

  readonly agents = AGENTS;
  readonly agentLabels = AGENT_LABELS;
  readonly statuses = REVIEW_STATUSES;
  readonly statusLabels = REVIEW_STATUS_LABELS;

  readonly agent = signal<Agent | ''>('');
  readonly status = signal<ReviewStatus | ''>('');
  readonly from = signal('');
  readonly to = signal('');

  readonly pager = new CursorPager<LlmReview>((cursor) =>
    this.service.reviews(this.filters(), cursor, PAGE_SIZE),
  );
  readonly state = computed(() => pagerState(this.pager));
  readonly rows = computed(() => this.pager.items().map(reviewRow));
  readonly filtered = computed(() => !!(this.agent() || this.status() || this.from() || this.to()));

  constructor() {
    this.pager.first();
    inject(DestroyRef).onDestroy(() => this.pager.state.cancel());
  }

  filters(): ReviewFilters {
    return {
      agent: this.agent() || null,
      status: this.status() || null,
      date_from: dayBoundary(this.from(), 'from'),
      date_to: dayBoundary(this.to(), 'to'),
    };
  }

  /** The cursor belongs to its filters, so any change starts again from the first page. */
  setAgent(value: Agent | ''): void {
    this.agent.set(value);
    this.pager.first();
  }

  setStatus(value: ReviewStatus | ''): void {
    this.status.set(value);
    this.pager.first();
  }

  setFrom(value: string): void {
    this.from.set(value);
    this.pager.first();
  }

  setTo(value: string): void {
    this.to.set(value);
    this.pager.first();
  }

  clear(): void {
    this.agent.set('');
    this.status.set('');
    this.from.set('');
    this.to.set('');
    this.pager.first();
  }
}
