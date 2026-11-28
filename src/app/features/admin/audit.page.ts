import { Component, computed, DestroyRef, inject, signal, WritableSignal } from '@angular/core';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideCalendar,
  LucideFileSearch,
  LucideRefreshCw,
  LucideSearch,
  LucideTag,
} from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import { dayBound } from '../runs/day-bound';
import { formatDateTime } from '../../shared/labels';
import {
  AUDIT_ACTION_LABELS,
  auditActionLabel,
  auditTarget,
  KNOWN_AUDIT_ACTIONS,
} from './audit-labels';
import { AuditEntry, AuditFilters, AuditService } from './audit.service';

const PAGE_SIZE = 50;
/** The API caps both text filters at 100 characters (422 above). */
export const FILTER_MAX_LENGTH = 100;

/** An entry with everything the table shows, already in Spanish. */
export interface AuditRow {
  id: string;
  when: string;
  actor: string;
  automatic: boolean;
  action: string;
  actionLabel: string | null;
  target: string;
  /** The object as its kind's Spanish name and id (AUD-2); null for a kind the front does not know. */
  targetParts: { label: string; id: string } | null;
}

function toRow(entry: AuditEntry): AuditRow {
  return {
    id: entry.id,
    when: formatDateTime(entry.created_at),
    actor: entry.actor,
    automatic: entry.actor === 'sistema',
    action: entry.action,
    actionLabel: auditActionLabel(entry.action),
    target: entry.target,
    targetParts: auditTarget(entry.target),
  };
}

/**
 * Auditoría (docs/13 API-06, admin): the audit trail of `GET /api/audit`, newest first, filtered by actor (e-mail or
 * name; «sistema» for the automatic ones), exact action and dates, paged by cursor. It never shows the values that
 * changed, only who did what to which object and when.
 */
@Component({
  selector: 'app-audit-page',
  imports: [
    BannerPagina,
    AsyncStateComponent,
    LucideArrowLeft,
    LucideArrowRight,
    LucideCalendar,
    LucideFileSearch,
    LucideRefreshCw,
    LucideSearch,
    LucideTag,
  ],
  templateUrl: './audit-page.html',
  styleUrls: ['./admin-tables.css', './audit-page.css'],
})
export class AuditPage {
  private readonly service = inject(AuditService);

  readonly bannerIcon = LucideFileSearch;
  readonly maxLength = FILTER_MAX_LENGTH;
  readonly knownActions = KNOWN_AUDIT_ACTIONS;
  readonly actionLabels = AUDIT_ACTION_LABELS;

  readonly actor = signal('');
  readonly action = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly hasFilters = computed(
    () => !!(this.actor() || this.action() || this.dateFrom() || this.dateTo()),
  );
  private readonly filters = computed<AuditFilters>(() => ({
    actor: this.actor() || null,
    action: this.action() || null,
    date_from: dayBound(this.dateFrom(), false),
    date_to: dayBound(this.dateTo(), true),
  }));

  readonly pager = new CursorPager<AuditEntry>((cursor) =>
    this.service.list(this.filters(), cursor, PAGE_SIZE),
  );
  readonly rows = computed(() => this.pager.items().map(toRow));

  readonly tableState = computed<ViewState | null>(() => {
    const status = this.pager.state.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.pager.items().length ? null : 'empty';
  });

  constructor() {
    this.pager.first();
    inject(DestroyRef).onDestroy(() => this.pager.state.cancel());
  }

  setActor(value: string): void {
    this.setText(this.actor, value);
  }

  setAction(value: string): void {
    this.setText(this.action, value);
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
    this.actor.set('');
    this.action.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.pager.first();
  }

  /** Filters only when the text really changes (a blur without edits does not reload). */
  private setText(target: WritableSignal<string>, value: string): void {
    const text = value.trim().slice(0, FILTER_MAX_LENGTH);
    if (text === target()) return;
    target.set(text);
    this.pager.first();
  }
}
