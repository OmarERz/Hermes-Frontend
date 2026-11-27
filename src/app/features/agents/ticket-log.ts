import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideArrowRight, LucideTicket } from '@lucide/angular';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import { safeExternalUrl } from '../../shared/itop-links';
import { formatDateTime } from '../../shared/labels';
import {
  ITOP_WRITE_LABELS,
  labelOf,
  TICKET_ACTION_LABELS,
  TICKET_ACTIONS,
  TicketAction,
} from './agent-labels';
import { AgentsService, TicketUpdate, TicketUpdateFilters } from './agents.service';
import { pagerState } from './reviews-log';

const PAGE_SIZE = 25;

/**
 * The iTop id of a ticket from what a person types: its number ("123") or its iTop reference ("R-000123"). Anything
 * else is not a ticket (null); an empty value means every ticket ('').
 */
export function ticketIdOf(value: string): string | null {
  const text = value.trim();
  if (!text) return '';
  const match = /^(?:R-?)?(\d{1,12})$/i.exec(text);
  if (!match) return null;
  return String(Number(match[1]));
}

/** One row of the log, already in Spanish. */
export function ticketRow(update: TicketUpdate) {
  return {
    id: update.id,
    at: formatDateTime(update.created_at),
    ticket: update.ticket_ref ?? update.ticket_itop_id ?? 'Por crear en iTop',
    url: safeExternalUrl(update.ticket_url),
    cve: update.cve,
    custodian: update.custodian,
    action: update.label || labelOf(TICKET_ACTION_LABELS, update.action),
    write:
      update.itop_status === null
        ? 'Sin dato (purgado)'
        : labelOf(ITOP_WRITE_LABELS, update.itop_status),
    writeKey: update.itop_status ?? 'none',
    assessmentId: update.assessment_id,
  };
}

/**
 * «Bitácora de tickets» (HI-4): what Hermes did on each iTop ticket and why, newest first
 * (`GET /api/tickets/updates`), with ticket and action filters and cursor pages. The ticket lifecycle itself lives
 * in iTop: Hermes only creates tickets, adds CIs, comments and raises or lowers urgency.
 */
@Component({
  selector: 'app-ticket-log',
  imports: [
    FormsModule,
    RouterLink,
    AsyncStateComponent,
    LucideArrowLeft,
    LucideArrowRight,
    LucideTicket,
  ],
  templateUrl: './ticket-log.html',
  styleUrls: ['./agents-tables.css', './ticket-log.css'],
})
export class TicketLog {
  private readonly service = inject(AgentsService);

  readonly actions = TICKET_ACTIONS;
  readonly actionLabels = TICKET_ACTION_LABELS;

  readonly ticketInput = signal('');
  readonly ticket = signal('');
  readonly action = signal<TicketAction | ''>('');
  readonly ticketError = signal('');

  readonly pager = new CursorPager<TicketUpdate>((cursor) =>
    this.service.ticketUpdates(this.filters(), cursor, PAGE_SIZE),
  );
  readonly state = computed(() => pagerState(this.pager));
  readonly rows = computed(() => this.pager.items().map(ticketRow));
  readonly filtered = computed(() => !!(this.ticket() || this.action()));

  constructor() {
    this.pager.first();
    inject(DestroyRef).onDestroy(() => this.pager.state.cancel());
  }

  filters(): TicketUpdateFilters {
    return { ticket_itop_id: this.ticket() || null, action: this.action() || null };
  }

  /** Applies the typed ticket (on Enter or when the field loses focus); an invalid one is not sent. */
  applyTicket(): void {
    const id = ticketIdOf(this.ticketInput());
    if (id === null) {
      this.ticketError.set(
        'Escribe el número del ticket en iTop (por ejemplo 123) o su referencia (R-000123).',
      );
      return;
    }
    this.ticketError.set('');
    if (id === this.ticket()) return;
    this.ticket.set(id);
    this.pager.first();
  }

  setAction(value: TicketAction | ''): void {
    this.action.set(value);
    this.pager.first();
  }

  clear(): void {
    this.ticketInput.set('');
    this.ticket.set('');
    this.ticketError.set('');
    this.action.set('');
    this.pager.first();
  }
}
