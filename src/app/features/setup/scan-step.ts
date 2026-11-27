import { Component, computed, DestroyRef, inject, output, signal } from '@angular/core';
import { LucidePlay } from '@lucide/angular';
import { Subscription } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { formatDateTime } from '../../shared/labels';
import { RunEventsService, RunProgress } from '../runs/run-events';
import { Run, SetupService } from './setup.service';

export const RUN_STATUS_LABELS: Record<Run['status'], string> = {
  queued: 'En cola',
  running: 'En ejecución',
  succeeded: 'Terminó bien',
  failed: 'Terminó con error',
};

export function isActive(run: Pick<Run, 'status'>): boolean {
  return run.status === 'queued' || run.status === 'running';
}

/** The followed run with the progress and the status of its last stream event. */
function withProgress(run: Run, progress: RunProgress): Run {
  return { ...run, progress: progress.progress, status: progress.status ?? run.status };
}

/**
 * Paso 7 · Primer escaneo (docs/13 §9): launches the simulated scan (`POST /api/scans`) and follows its progress live
 * over `GET /api/runs/{id}/events` (the stream of Corridas, which sends the Bearer token): each event carries the
 * run's `status`, and the stream ends with the final one. Then `GET /api/runs/{id}` gives the final row (status,
 * progress, end). It starts by showing the latest scan, and keeps following it if it is still queued or running;
 * until that first reading succeeds, launching stays off, so a failed reading never hides a scan in progress.
 */
@Component({
  selector: 'app-setup-scan-step',
  imports: [LucidePlay],
  template: `
    <div class="step-toolbar">
      <span class="step-count">
        @if (loading()) {
          Buscando el último escaneo…
        } @else if (loadFailed()) {
          No se pudo leer el último escaneo.
        } @else if (!run()) {
          Todavía no hay escaneos.
        }
      </span>
      <button
        type="button"
        class="step-button launch-scan"
        [disabled]="launching() || loading() || loadFailed() || active()"
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
        @if (loadFailed()) {
          <button type="button" class="step-button" (click)="loadLatest()">Reintentar</button>
        } @else if (stalled()) {
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
  private readonly runEvents = inject(RunEventsService);
  private following: Subscription | null = null;
  private initial: Subscription | null = null;

  /** The followed scan ended (the wizard reads its steps again: step 7 is done after a successful scan). */
  readonly finished = output<void>();

  readonly run = signal<Run | null>(null);
  readonly loading = signal(true);
  /** The first reading of the latest scan failed: launching waits for a successful retry. */
  readonly loadFailed = signal(false);
  readonly launching = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  /** Following stopped before the run ended (the stream or the final reading failed): it can be resumed. */
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
    this.loadLatest();
    inject(DestroyRef).onDestroy(() => {
      this.initial?.unsubscribe();
      this.following?.unsubscribe();
    });
  }

  /** Reads the latest scan (and follows it if it is still queued or running). */
  loadLatest(): void {
    this.initial?.unsubscribe();
    this.loading.set(true);
    this.loadFailed.set(false);
    this.error.set(null);
    this.initial = this.service.scans(1).subscribe({
      next: ([latest]) => {
        this.loading.set(false);
        this.run.set(latest ?? null);
        if (latest && isActive(latest)) this.follow(latest);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadFailed.set(true);
        this.error.set(toApiError(error).message);
      },
    });
  }

  launch(): void {
    if (this.launching() || this.loading() || this.loadFailed() || this.active()) return;
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
        this.follow(created);
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
    this.follow(current);
  }

  /** Follows the run's stream; when it ends, reads the final row of the run. */
  private follow(followed: Run): void {
    this.following?.unsubscribe();
    let last: RunProgress | null = null;
    this.following = this.runEvents.watch(followed.id).subscribe({
      next: (progress) => {
        last = progress;
        this.run.update((current) =>
          current?.id === followed.id ? withProgress(current, progress) : current,
        );
      },
      complete: () => this.readFinal(followed.id, last),
      error: (error: unknown) => this.stall(toApiError(error).message),
    });
  }

  /**
   * The stream ended with a final status: `GET /api/runs/{id}` gives the final row. If that reading fails, the last
   * event already said how the run ended, so the step reports it with what it has.
   */
  private readFinal(runId: string, last: RunProgress | null): void {
    this.following = this.service.run(runId).subscribe({
      next: (final) => {
        this.run.set(final);
        if (!isActive(final)) {
          this.ended(final.status);
        } else {
          this.stall('El escaneo sigue en curso: consulta su avance en Corridas.');
        }
      },
      error: (error: unknown) => {
        const status = last?.status;
        if (status && !isActive({ status })) this.ended(status);
        else this.stall(toApiError(error).message);
      },
    });
  }

  private ended(status: Run['status']): void {
    this.notice.set(
      status === 'succeeded'
        ? 'El escaneo terminó bien.'
        : 'El escaneo terminó con error; revisa el detalle en Corridas.',
    );
    this.finished.emit();
  }

  private stall(message: string): void {
    this.stalled.set(true);
    this.error.set(message);
  }
}
