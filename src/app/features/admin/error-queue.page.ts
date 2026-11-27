import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideChevronDown,
  LucideFunnel,
  LucideRefreshCw,
  LucideRotateCcw,
  LucideTriangleAlert,
} from '@lucide/angular';
import { finalize } from 'rxjs';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { toApiError } from '../../core/api/api-error';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { Chip } from '../../shared/chip';
import { CursorPager } from '../../shared/cursor-pager';
import { formatDateTime } from '../../shared/labels';
import {
  ERROR_KINDS,
  ErrorKind,
  ErrorQueueItem,
  ErrorQueueService,
  ErrorStatus,
  COMPONENT_LABELS,
  KIND_LABELS,
  retryScheduled,
  statusText,
} from './error-queue.service';

const PAGE_SIZE = 50;

/** An item with everything the table shows, already in Spanish. */
export interface ErrorRow {
  item: ErrorQueueItem;
  id: string;
  when: string;
  kindLabel: string;
  component: string;
  /** The raw value of the API, for the tooltip. */
  componentCode: string;
  status: ErrorStatus;
  statusLabel: string;
  scheduled: boolean;
  attempts: number;
  nextAttempt: string;
  error: string;
  cve: string | null;
  ticket: string | null;
  assessmentId: string | null;
  retryable: boolean;
}

function labelOf<K extends string>(labels: Record<K, string>, value: string): string {
  return (labels as Record<string, string>)[value] ?? value;
}

function toRow(item: ErrorQueueItem): ErrorRow {
  return {
    item,
    id: item.id,
    when: formatDateTime(item.created_at),
    kindLabel: labelOf(KIND_LABELS, item.kind),
    component: labelOf(COMPONENT_LABELS, item.component),
    componentCode: item.component,
    status: item.status,
    statusLabel: statusText(item),
    scheduled: retryScheduled(item),
    attempts: item.attempts,
    nextAttempt: item.next_attempt_at ? formatDateTime(item.next_attempt_at) : 'Sin reintento',
    error: item.error?.trim() || 'Sin detalle',
    cve: item.cve,
    ticket: item.ticket_ref ?? item.ticket_itop_id,
    assessmentId: item.assessment_id,
    retryable: item.retryable,
  };
}

/** Codes after which the item is no longer in error: the list is read again instead of retrying. */
const GONE_CODES = new Set(['not_in_error', 'not_found']);

/**
 * Cola de errores (FRO-18, NOT-02, admin): what failed and waits for a person, from `GET /api/error-queue`, newest
 * first and paged by cursor: notification events and iTop writes that exhausted their retries, and items an analyst
 * or the judge could not validate. Only the items the API marks `retryable` (today, notification events) offer a
 * retry (`POST /api/notifications/events/{id}/retry`); the error text is external data, shown as text.
 */
@Component({
  selector: 'app-error-queue-page',
  imports: [
    RouterLink,
    BannerPagina,
    AsyncStateComponent,
    Chip,
    LucideArrowLeft,
    LucideArrowRight,
    LucideChevronDown,
    LucideFunnel,
    LucideRefreshCw,
    LucideRotateCcw,
    LucideTriangleAlert,
  ],
  templateUrl: './error-queue-page.html',
  styleUrls: ['./admin-tables.css', './error-queue-page.css'],
})
export class ErrorQueuePage {
  private readonly service = inject(ErrorQueueService);
  private readonly destroyRef = inject(DestroyRef);

  readonly bannerIcon = LucideTriangleAlert;
  readonly kinds = ERROR_KINDS;
  readonly kindLabels = KIND_LABELS;

  readonly kind = signal<ErrorKind | ''>('');
  readonly pager = new CursorPager<ErrorQueueItem>((cursor) =>
    this.service.list(this.kind() || null, cursor, PAGE_SIZE),
  );
  readonly rows = computed(() => this.pager.items().map(toRow));

  readonly tableState = computed<ViewState | null>(() => {
    const status = this.pager.state.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.pager.items().length ? null : 'empty';
  });

  /** Items whose retry is on its way (their button is disabled until the API answers). */
  readonly retrying = signal<ReadonlySet<string>>(new Set());
  readonly notice = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  constructor() {
    this.pager.first();
    this.destroyRef.onDestroy(() => this.pager.state.cancel());
  }

  setKind(value: string): void {
    this.kind.set(value as ErrorKind | '');
    this.pager.first();
  }

  refresh(): void {
    this.notice.set(null);
    this.pager.reload();
  }

  isRetrying(id: string): boolean {
    return this.retrying().has(id);
  }

  /** Queues a notification event again; the list is read again either way. */
  retry(row: ErrorRow): void {
    if (!row.retryable || this.isRetrying(row.id)) return;
    this.setRetrying(row.id, true);
    this.notice.set(null);
    this.service
      .retry(row.id)
      .pipe(
        finalize(() => this.setRetrying(row.id, false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notice.set({
            kind: 'ok',
            text: `La notificación «${row.component}» volvió a la cola: Hermes intentará entregarla de nuevo.`,
          });
          this.pager.reload();
        },
        error: (error: unknown) => {
          const failure = toApiError(error);
          this.notice.set({ kind: 'error', text: failure.message });
          if (GONE_CODES.has(failure.code)) this.pager.reload();
        },
      });
  }

  private setRetrying(id: string, on: boolean): void {
    this.retrying.update((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
