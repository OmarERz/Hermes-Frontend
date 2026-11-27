import { Component, computed, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideRefreshCw } from '@lucide/angular';
import { finalize, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import {
  CONNECTION_NAMES,
  connectionDetail,
  connectionInfo,
  connectionState,
  ConnectionStatus,
  formatLatency,
  STATE_LABELS,
} from '../connections/connection-labels';
import { ConnectionsService } from '../connections/connections.service';

/** Puts each fresh result in place of the old one, keeping the order of the Conexiones screen. */
export function withFresh(
  current: readonly ConnectionStatus[],
  fresh: readonly ConnectionStatus[],
): ConnectionStatus[] {
  const byName = new Map<string, ConnectionStatus>(current.map((status) => [status.name, status]));
  for (const status of fresh) byName.set(status.name, status);
  const order: readonly string[] = CONNECTION_NAMES;
  const rank = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length);
  return [...byName.values()].sort((a, b) => rank(a.name) - rank(b.name));
}

/**
 * Paso 1 · Conexiones (docs/13 §9): ✅/❌ per external service with its latency and the variable the server lacks,
 * from `GET /api/connections/status`, and «Probar de nuevo» (`POST /api/connections/test`). It never asks for a key:
 * the API only says which variable is missing, never a value (SEG-23).
 */
@Component({
  selector: 'app-setup-connections-step',
  imports: [AsyncStateComponent, LucideRefreshCw],
  template: `
    <div class="step-toolbar">
      <span class="step-count">
        @if (load.status() === 'ready') {
          {{ okCount() }} de {{ rows().length }} conexiones funcionan
        }
      </span>
      <button
        type="button"
        class="step-button"
        [disabled]="testing() || load.status() !== 'ready'"
        [attr.aria-busy]="testing()"
        (click)="testAll()"
      >
        <svg lucideRefreshCw aria-hidden="true"></svg>
        {{ testing() ? 'Probando…' : 'Probar de nuevo' }}
      </button>
    </div>
    @if (testError(); as problem) {
      <p class="step-message error" role="alert">{{ problem }}</p>
    }
    @switch (load.status()) {
      @case ('error') {
        <app-async-state state="error" [error]="load.error()" (retry)="reload()" />
      }
      @case ('ready') {
        <ul class="step-list connection-list">
          @for (row of rows(); track row.name) {
            <li [attr.data-name]="row.name">
              <span class="item-mark" [attr.data-state]="row.state" aria-hidden="true">{{
                row.state === 'ok' ? '✅' : '❌'
              }}</span>
              <span class="item-copy">
                <strong>{{ row.title }}</strong>
                <small>{{ row.purpose }}</small>
              </span>
              <span class="item-state" [attr.data-state]="row.state">{{ row.stateLabel }}</span>
              <span class="item-detail">
                @if (row.missing) {
                  Falta la variable <code>{{ row.missing }}</code> en el servidor
                } @else {
                  {{ row.detail }}
                }
              </span>
              <span class="item-number">{{ row.latency }}</span>
            </li>
          } @empty {
            <li class="item-empty">La API no reportó conexiones.</li>
          }
        </ul>
      }
      @default {
        <app-async-state state="loading" loadingText="Cargando el estado de las conexiones…" />
      }
    }
  `,
  styleUrl: './setup-step.css',
})
export class SetupConnectionsStep {
  private readonly service = inject(ConnectionsService);
  private readonly destroyRef = inject(DestroyRef);

  /** A new check finished (the wizard reads its steps again: step 1 is done when every service works). */
  readonly checked = output<void>();

  readonly load = new AsyncState<ConnectionStatus[]>();
  readonly statuses = signal<ConnectionStatus[]>([]);
  readonly testing = signal(false);
  readonly testError = signal<string | null>(null);

  readonly rows = computed(() =>
    this.statuses().map((status) => {
      const state = connectionState(status);
      const info = connectionInfo(status.name);
      return {
        name: status.name,
        title: info.title,
        purpose: info.purpose,
        state,
        stateLabel: STATE_LABELS[state],
        missing: status.ok ? null : status.missing_variable,
        detail: connectionDetail(status),
        latency: formatLatency(status.latency_ms),
      };
    }),
  );
  readonly okCount = computed(() => this.rows().filter((row) => row.state === 'ok').length);

  constructor() {
    this.reload();
    this.destroyRef.onDestroy(() => this.load.cancel());
  }

  reload(): void {
    this.load.run(
      this.service.status().pipe(tap((statuses) => this.statuses.set(withFresh([], statuses)))),
    );
  }

  /** «Probar de nuevo»: checks every connection again (the API keeps a result checked in the last 30 seconds). */
  testAll(): void {
    if (this.testing()) return;
    this.testing.set(true);
    this.testError.set(null);
    this.service
      .test(null)
      .pipe(
        finalize(() => this.testing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (fresh) => {
          this.statuses.update((current) => withFresh(current, fresh));
          this.checked.emit();
        },
        error: (error: unknown) => this.testError.set(toApiError(error).message),
      });
  }
}
