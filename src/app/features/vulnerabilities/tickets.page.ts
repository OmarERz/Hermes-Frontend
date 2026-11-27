import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideChevronDown,
  LucideFunnel,
  LucideRadar,
  LucideTicket,
} from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { Chip, ChipTone } from '../../shared/chip';
import { CursorPager } from '../../shared/cursor-pager';
import { ItopLink } from '../../shared/itop-links';
import { formatDateTime, formatShortDateTime } from '../../shared/labels';
import { ScrollFade } from '../../shared/scroll-fade.directive';
import { ThreatAlert, Ticket, TicketsService } from './tickets.service';
import { RELEVANCE_LABELS, URGENCY_LABELS } from './vulnerability-texts';

const PAGE_SIZE = 25;

function tableState(pager: CursorPager<unknown>): ViewState | null {
  const status = pager.state.status();
  if (status === 'idle' || status === 'loading') return 'loading';
  if (status === 'error') return 'error';
  return pager.items().length ? null : 'empty';
}

/** iTop urgency 1 to 4 as the level colours of the shared chip (G10). */
const URGENCY_TONES: Record<number, ChipTone> = { 1: 'critical', 2: 'high', 3: 'medium', 4: 'low' };

/**
 * Tickets y alertas: the iTop tickets Hermes created (real iTop states, fixed versus total assets and the link to
 * the ticket in iTop) and the threat alerts (R2, R3 or inferred by the AI). Both lists page by cursor.
 */
@Component({
  selector: 'app-tickets-page',
  imports: [
    FormsModule,
    RouterLink,
    BannerPagina,
    AsyncStateComponent,
    Chip,
    ItopLink,
    ScrollFade,
    LucideArrowLeft,
    LucideArrowRight,
    LucideChevronDown,
    LucideFunnel,
    LucideRadar,
    LucideTicket,
  ],
  templateUrl: './tickets.page.html',
  styleUrls: ['./vulnerability-chips.css', './tickets.page.css'],
})
export class TicketsPage {
  private readonly service = inject(TicketsService);

  readonly bannerIcon = LucideTicket;
  readonly urgencies = [1, 2, 3, 4];
  readonly urgencyLabels = URGENCY_LABELS;
  readonly relevanceLabels = RELEVANCE_LABELS;
  readonly formatDateTime = formatDateTime;
  readonly formatShortDateTime = formatShortDateTime;

  readonly urgency = signal<number | null>(null);

  readonly tickets = new CursorPager<Ticket>((cursor) =>
    this.service.listTickets(this.urgency(), cursor, PAGE_SIZE),
  );
  readonly alerts = new CursorPager<ThreatAlert>((cursor) =>
    this.service.listAlerts(cursor, PAGE_SIZE),
  );

  readonly ticketState = computed(() => tableState(this.tickets));
  readonly alertState = computed(() => tableState(this.alerts));

  readonly ticketRows = computed(() =>
    this.tickets.items().map((ticket) => ({
      ...ticket,
      urgencyLabel: URGENCY_LABELS[ticket.urgency] ?? String(ticket.urgency),
      urgencyTone: URGENCY_TONES[ticket.urgency] ?? 'neutral',
      progress: ticket.total_cis ? Math.round((ticket.fixed_cis / ticket.total_cis) * 100) : 0,
    })),
  );

  constructor() {
    this.tickets.first();
    this.alerts.first();
    inject(DestroyRef).onDestroy(() => {
      this.tickets.state.cancel();
      this.alerts.state.cancel();
    });
  }

  /** The cursor belongs to its filter, so a new urgency starts again from the first page. */
  setUrgency(value: number | null): void {
    this.urgency.set(value);
    this.tickets.first();
  }
}
