import { Component, computed, DestroyRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideActivity,
  LucideArrowRight,
  LucideBot,
  LucideFileClock,
  LucideLayers,
  LucideMonitor,
  LucideSlidersHorizontal,
} from '@lucide/angular';
import { SessionService } from '../../core/auth/session.service';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { formatDateTime } from '../../shared/labels';
import { formatCount, formatPercent } from '../agents/formatting';
import { HomeService, InventorySummary, TelemetrySummary, TicketSummary } from './home.service';

/** What a summary card shows while its source loads or after it failed. */
const LOADING = '…';
const UNAVAILABLE = 'No disponible';

function cardValue<T>(state: AsyncState<T>, read: (value: T) => string): string {
  const value = state.value();
  if (state.status() === 'ready' && value !== null) return read(value);
  return state.status() === 'error' ? UNAVAILABLE : LOADING;
}

/**
 * Inicio: the prototype's welcome screen (same design) with its four summary cards on real data. Software and assets
 * come from the iTop inventory (`GET /api/inventory/summary`), open tickets from `GET /api/tickets/summary` and the
 * success rate from the runs of the last 7 days (`GET /api/telemetry/summary`). A card whose source fails reads
 * «No disponible», never an invented number.
 */
@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    AsyncStateComponent,
    LucideActivity,
    LucideArrowRight,
    LucideBot,
    LucideFileClock,
    LucideLayers,
    LucideMonitor,
    LucideSlidersHorizontal,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage {
  private readonly session = inject(SessionService);
  private readonly service = inject(HomeService);

  readonly inventory = new AsyncState<InventorySummary>();
  readonly tickets = new AsyncState<TicketSummary>();
  readonly telemetry = new AsyncState<TelemetrySummary>();

  /** Display name from GET /api/me (else from Firebase), or the user part of the e-mail. */
  readonly greetingName = computed(() => {
    const profile = this.session.profile();
    const user = this.session.user();
    const displayName = profile?.display_name?.trim() || user?.displayName?.trim();
    if (displayName) return displayName;
    const email = profile?.email ?? user?.email;
    return email?.split('@', 1)[0].trim() || 'Usuario';
  });

  readonly softwareCount = computed(() =>
    cardValue(this.inventory, (summary) => formatCount(summary.software.total)),
  );
  readonly assetCount = computed(() =>
    cardValue(this.inventory, (summary) => formatCount(summary.total_assets)),
  );
  /** Tickets not resolved yet: open in iTop plus the ones waiting to be created there. */
  readonly openTickets = computed(() =>
    cardValue(this.tickets, (summary) =>
      formatCount((summary.by_status['open'] ?? 0) + (summary.by_status['pending_creation'] ?? 0)),
    ),
  );
  readonly runSuccess = computed(() =>
    cardValue(this.telemetry, (summary) => formatPercent(summary.run_success_percent)),
  );

  /** Last time a CI was synchronised with iTop, for the data line under the cards. */
  readonly lastSync = computed(() => {
    const summary = this.inventory.value();
    if (this.inventory.status() !== 'ready' || !summary) return null;
    return summary.last_sync_at
      ? `última sincronización con iTop: ${formatDateTime(summary.last_sync_at)}`
      : 'iTop todavía no se ha sincronizado';
  });

  /** The first failure among the three sources, shown once under the cards with a retry. */
  readonly failure = computed(
    () => this.inventory.error() ?? this.tickets.error() ?? this.telemetry.error(),
  );

  constructor() {
    this.loadInventory();
    this.loadTickets();
    this.loadTelemetry();
    inject(DestroyRef).onDestroy(() => {
      this.inventory.cancel();
      this.tickets.cancel();
      this.telemetry.cancel();
    });
  }

  /** Loads again only the sources that failed. */
  retryFailed(): void {
    if (this.inventory.status() === 'error') this.loadInventory();
    if (this.tickets.status() === 'error') this.loadTickets();
    if (this.telemetry.status() === 'error') this.loadTelemetry();
  }

  private loadInventory(): void {
    this.inventory.run(this.service.inventorySummary());
  }

  private loadTickets(): void {
    this.tickets.run(this.service.ticketSummary());
  }

  private loadTelemetry(): void {
    this.telemetry.run(this.service.telemetrySummary());
  }
}
