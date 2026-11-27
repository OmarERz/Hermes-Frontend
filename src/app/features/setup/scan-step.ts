import {
  Component,
  computed,
  DestroyRef,
  inject,
  InjectionToken,
  output,
  signal,
} from '@angular/core';
import { LucidePlay } from '@lucide/angular';
import { map, Subscription, switchMap, take, takeWhile, timer } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { formatDateTime } from '../../shared/labels';
import { Run, SetupService } from './setup.service';

/**
 * How the step follows a queued or running scan: it reads the runs every `intervalMs` milliseconds, and after
 * `maxPolls` reads (about 10 minutes) it stops and points to Corridas.
 */
export interface ScanPolling {
  intervalMs: number;
  maxPolls: number;
}
export const SCAN_POLLING = new InjectionToken<ScanPolling>('SCAN_POLLING', {
  factory: () => ({ intervalMs: 3000, maxPolls: 200 }),
});
/** The newest scans read on each poll to find the one being followed. */
const SCANS_READ = 20;

export const RUN_STATUS_LABELS: Record<Run['status'], string> = {
  queued: 'En cola',
  running: 'En ejecución',
  succeeded: 'Terminó bien',
  failed: 'Terminó con error',
};

export function isActive(run: Pick<Run, 'status'>): boolean {
  return run.status === 'queued' || run.status === 'running';
}

/**
 * Paso 7 · Primer escaneo (docs/13 §9): launches the simulated scan (`POST /api/scans`) and shows its progress by
 * reading `GET /api/runs` every few seconds until it ends (Corridas follows it live). It starts by showing the latest
 * scan, and keeps following it if it is still queued or running.
 */
@Component({
  selector: 'app-setup-scan-step',
  imports: [LucidePlay],
  template: `
    <div class="step-toolbar">
      <span class="step-count">
        @if (loading()) {
          Buscando el último escaneo…
        } @else if (!run()) {
          Todavía no hay escaneos.
        }
      </span>
      <button
        type="button"
        class="step-button launch-scan"
        [disabled]="launching() || loading() || active()"
        [attr.aria-busy]="launching()"
        (click)="launch()"
      >
        <svg lucidePlay aria-hidden="true"></svg>
        {{ launching() ? 'Lanzando…' : run() ? 'Lanzar otro escaneo' : 'Lanzar escaneo simulado' }}
      </button>
    </div>
    @if (error(); as problem) {
      <div class="step-message error" role="alert">
        {{ problem }}
        @if (stalled()) {
          <button type="button" class="step-button" (click)="resume()">Volver a consultar</button>
        }
      </div>
    }
    @if (notice(); as message) {
      <p class="step-message" role="status">{{ message }}</p>
    }
    @if (run(); as current) {
      <div class="scan-run" [attr.data-status]="current.status">
        <p class="scan-status">
          <strong>{{ statusLabel() }}</strong>
          <span>Iniciado {{ startedAt() }}</span>
        </p>
        <progress max="100" [value]="current.progress" aria-label="Avance del escaneo"></progress>
        <span class="item-number" aria-live="polite">{{ current.progress }} %</span>
      </div>
    }
  `,
  styleUrl: './setup-step.css',
})
export class SetupScanStep {
  private readonly service = inject(SetupService);
  private readonly polling = inject(SCAN_POLLING);
  private following: Subscription | null = null;
  private initial: Subscription | null = null;

  /** The followed scan ended (the wizard reads its steps again: step 7 is done after a successful scan). */
  readonly finished = output<void>();

  readonly run = signal<Run | null>(null);
  readonly loading = signal(true);
  readonly launching = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  /** Following stopped before the run ended (an error or too long): it can be resumed. */
  readonly stalled = signal(false);

  readonly active = computed(() => {
    const current = this.run();
    return current !== null && isActive(current);
  });
  readonly statusLabel = computed(() => {
    const current = this.run();
    return current ? RUN_STATUS_LABELS[current.status] : '';
  });
  readonly startedAt = computed(() => {
    const current = this.run();
    return current ? formatDateTime(current.started_at) : '';
  });

  constructor() {
    this.initial = this.service.scans(1).subscribe({
      next: ([latest]) => {
        this.loading.set(false);
        this.run.set(latest ?? null);
        if (latest && isActive(latest)) this.follow(latest.id);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(error).message);
      },
    });
    inject(DestroyRef).onDestroy(() => {
      this.initial?.unsubscribe();
      this.following?.unsubscribe();
    });
  }

  launch(): void {
    if (this.launching() || this.active()) return;
    this.launching.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.stalled.set(false);
    this.following?.unsubscribe();
    this.following = this.service.launchScan().subscribe({
      next: (created) => {
        this.launching.set(false);
        this.run.set(created);
        this.notice.set('Se lanzó el escaneo simulado; el worker lo toma en unos segundos.');
        this.follow(created.id);
      },
      error: (error: unknown) => {
        this.launching.set(false);
        this.error.set(toApiError(error).message);
      },
    });
  }

  /** Follows the run again after an error or a long wait. */
  resume(): void {
    const current = this.run();
    if (!current) return;
    this.error.set(null);
    this.stalled.set(false);
    this.follow(current.id);
  }

  private follow(id: string): void {
    this.following?.unsubscribe();
    let ended = false;
    const { intervalMs, maxPolls } = this.polling;
    this.following = timer(intervalMs, intervalMs)
      .pipe(
        take(maxPolls),
        switchMap(() => this.service.scans(SCANS_READ)),
        map((runs) => runs.find((run) => run.id === id) ?? null),
        takeWhile((run) => run === null || isActive(run), true),
      )
      .subscribe({
        next: (run) => {
          if (!run) return;
          this.run.set(run);
          if (!isActive(run)) {
            ended = true;
            this.notice.set(
              run.status === 'succeeded'
                ? 'El escaneo terminó bien.'
                : 'El escaneo terminó con error; revisa el detalle en Corridas.',
            );
            this.finished.emit();
          }
        },
        error: (error: unknown) => {
          this.stalled.set(true);
          this.error.set(toApiError(error).message);
        },
        complete: () => {
          if (ended) return;
          this.stalled.set(true);
          this.error.set('El escaneo sigue en curso: consulta su avance en Corridas.');
        },
      });
  }
}
