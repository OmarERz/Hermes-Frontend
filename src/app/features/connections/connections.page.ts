import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideCircleAlert,
  LucideCircleCheck,
  LucideClock,
  LucideDatabase,
  LucidePlug,
  LucideRefreshCw,
  LucideServer,
} from '@lucide/angular';
import { finalize, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import {
  CONNECTION_NAMES,
  connectionDetail,
  connectionInfo,
  ConnectionGroup,
  ConnectionName,
  connectionState,
  ConnectionState,
  ConnectionStatus,
  formatLatency,
  formatMoment,
  STATE_LABELS,
} from './connection-labels';
import { ConnectionsService } from './connections.service';

/** A connection with everything the table shows, already in Spanish. */
export interface ConnectionRow {
  name: ConnectionName;
  title: string;
  purpose: string;
  group: ConnectionGroup;
  state: ConnectionState;
  stateLabel: string;
  latency: string;
  checkedAt: string;
  lastOkAt: string;
  detail: string;
}

function toRow(status: ConnectionStatus): ConnectionRow {
  const info = connectionInfo(status.name);
  const state = connectionState(status);
  return {
    name: status.name,
    title: info.title,
    purpose: info.purpose,
    group: info.group,
    state,
    stateLabel: STATE_LABELS[state],
    latency: formatLatency(status.latency_ms),
    checkedAt: formatMoment(status.checked_at, 'Sin comprobar'),
    lastOkAt: formatMoment(status.last_ok_at, 'Sin éxito desde que arrancó la API'),
    detail: connectionDetail(status),
  };
}

const GROUP_TITLES: Record<ConnectionGroup, string> = {
  services: 'Servicios',
  sources: 'Fuentes de datos',
};

/** Puts each result of a new check in place of the old one, in the page order. */
export function mergeStatuses(
  current: readonly ConnectionStatus[],
  fresh: readonly ConnectionStatus[],
): ConnectionStatus[] {
  const byName = new Map<string, ConnectionStatus>(current.map((status) => [status.name, status]));
  for (const status of fresh) byName.set(status.name, status);
  const known: readonly string[] = CONNECTION_NAMES;
  const unknown = [...byName.keys()].filter((name) => !known.includes(name));
  return [...known, ...unknown].flatMap((name) => byName.get(name) ?? []);
}

/**
 * Conexiones (docs/13 §9 paso 1, FRONTEND.md §3, admin): iTop, the AI model (DeepSeek), Firebase and the data
 * sources (NVD, abuse.ch, ransomware.live), each with its state, latency, last check, last success and the generic
 * message of the API, in the Activos design. «Probar de nuevo» checks one or all of them again. The page only
 * verifies: keys live on the server (`.env` or Docker secrets) and no response carries one (SEG-23).
 */
@Component({
  selector: 'app-connections-page',
  imports: [
    BannerPagina,
    AsyncStateComponent,
    IfRoleDirective,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideClock,
    LucideDatabase,
    LucidePlug,
    LucideRefreshCw,
    LucideServer,
  ],
  templateUrl: './connections-page.html',
  styleUrl: './connections-page.css',
})
export class ConnectionsPage {
  private readonly service = inject(ConnectionsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly bannerIcon = LucidePlug;
  /** POST /api/connections/test is admin only, like the whole screen. */
  readonly testRole: Role = 'admin';

  readonly load = new AsyncState<ConnectionStatus[]>();
  readonly statuses = signal<ConnectionStatus[]>([]);
  /** Connections being checked right now (`all` while «Probar todas» runs). */
  readonly testing = signal<ReadonlySet<ConnectionName> | 'all' | null>(null);
  readonly busy = computed(() => this.testing() !== null);
  readonly testError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly rows = computed(() => this.statuses().map(toRow));
  /** Services first, then the data sources; a group without connections is left out. */
  readonly groups = computed(() =>
    (Object.keys(GROUP_TITLES) as ConnectionGroup[])
      .map((id) => ({
        id,
        title: GROUP_TITLES[id],
        rows: this.rows().filter((row) => row.group === id),
      }))
      .filter((group) => group.rows.length),
  );

  private readonly ready = computed(() => this.load.status() === 'ready');
  readonly total = computed(() => (this.ready() ? this.rows().length : null));
  readonly okCount = computed(() =>
    this.ready() ? this.rows().filter((row) => row.state === 'ok').length : null,
  );
  readonly problemCount = computed(() =>
    this.ready() ? this.rows().filter((row) => row.state !== 'ok').length : null,
  );
  /** The most recent check of any connection. */
  readonly lastCheck = computed(() => {
    if (!this.ready()) return null;
    const moments = this.statuses()
      .map((status) => status.checked_at)
      .filter((at): at is string => !!at)
      .sort();
    return formatMoment(moments.at(-1), 'Sin comprobar');
  });

  constructor() {
    this.reload();
    this.destroyRef.onDestroy(() => this.load.cancel());
  }

  reload(): void {
    this.load.run(this.service.status().pipe(tap((statuses) => this.statuses.set(statuses))));
  }

  isTesting(name: ConnectionName): boolean {
    const current = this.testing();
    return current === 'all' || (current?.has(name) ?? false);
  }

  /**
   * Checks one connection again (`null`: all of them) and puts the new results in place. «Probar todas» waits until
   * no check is running, and a single check waits for «Probar todas».
   */
  test(name: ConnectionName | null): void {
    const blocked = name === null ? this.busy() : this.isTesting(name);
    if (blocked) return;
    this.testing.set(name ? new Set([...this.testingNames(), name]) : 'all');
    this.testError.set(null);
    this.notice.set(null);
    this.service
      .test(name ? [name] : null)
      .pipe(
        finalize(() => this.release(name)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (fresh) => {
          this.statuses.update((current) => mergeStatuses(current, fresh));
          this.notice.set(
            name
              ? `Se comprobó ${connectionInfo(name).title} de nuevo.`
              : 'Se comprobaron todas las conexiones de nuevo.',
          );
        },
        error: (error: unknown) => this.testError.set(toApiError(error).message),
      });
  }

  private testingNames(): ReadonlySet<ConnectionName> {
    const current = this.testing();
    return current instanceof Set ? current : new Set();
  }

  private release(name: ConnectionName | null): void {
    if (!name) {
      this.testing.set(null);
      return;
    }
    const rest = new Set(this.testingNames());
    rest.delete(name);
    this.testing.set(rest.size ? rest : null);
  }
}
