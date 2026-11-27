import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideCircleCheck,
  LucideCircleDashed,
  LucideDynamicIcon,
  LucideListOrdered,
  LucideSkipForward,
  LucideWandSparkles,
} from '@lucide/angular';
import { finalize, Subscription, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { PeersPanel } from '../company/peers-panel';
import { ProfilePanel } from '../company/profile-panel';
import { SetupConnectionsStep } from './connections-step';
import { SetupInventoryStep } from './inventory-step';
import { SetupScanStep } from './scan-step';
import { SetupSensitivityStep } from './sensitivity-step';
import {
  firstOpenStep,
  MARK_BODIES,
  markNotice,
  nextOpenStep,
  SetupStep,
  STATE_LABELS,
  stepGuide,
  StepMark,
  StepState,
  stepState,
} from './setup-steps';
import { SetupService } from './setup.service';
import { SetupSourcesStep } from './sources-step';

/**
 * Asistente de primera configuración (docs/13 §9, D-042, admin): the seven steps of `GET /api/setup/status`, each
 * done, skipped or pending, in the Activos design. Every step says what it does and what happens if it is skipped,
 * and embeds or summarises its screen (connections, company profile, peers, sources, inventory, sensitivity, first
 * scan); everything can be changed later in those screens. A step is done when the data shows it or the admin marks
 * it (`PUT /api/setup/steps/{n}`). The wizard never captures a key: keys live on the server (SEG-23).
 */
@Component({
  selector: 'app-setup-page',
  imports: [
    RouterLink,
    BannerPagina,
    AsyncStateComponent,
    ProfilePanel,
    PeersPanel,
    SetupConnectionsStep,
    SetupSourcesStep,
    SetupInventoryStep,
    SetupSensitivityStep,
    SetupScanStep,
    LucideArrowLeft,
    LucideArrowRight,
    LucideCircleCheck,
    LucideCircleDashed,
    LucideDynamicIcon,
    LucideListOrdered,
    LucideSkipForward,
  ],
  templateUrl: './setup-page.html',
  styleUrl: './setup-page.css',
})
export class SetupPage {
  private readonly service = inject(SetupService);
  private readonly destroyRef = inject(DestroyRef);
  private refreshing: Subscription | null = null;
  /** Marks started so far: a reading of the steps started before a mark never replaces what the mark saved. */
  private marks = 0;

  readonly bannerIcon = LucideWandSparkles;

  readonly load = new AsyncState<SetupStep[]>();
  readonly steps = signal<SetupStep[]>([]);
  readonly selected = signal<number | null>(null);
  /** The step whose mark is being saved. */
  readonly marking = signal<number | null>(null);
  readonly markError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly views = computed(() =>
    this.steps().map((step) => {
      const state = stepState(step);
      return { ...step, state, stateLabel: STATE_LABELS[state], guide: stepGuide(step.n) };
    }),
  );
  readonly current = computed(
    () => this.views().find((step) => step.n === this.selected()) ?? null,
  );
  private readonly index = computed(() =>
    this.views().findIndex((step) => step.n === this.selected()),
  );
  readonly previous = computed(() => this.views()[this.index() - 1]?.n ?? null);
  readonly next = computed(() => {
    const index = this.index();
    return index < 0 ? null : (this.views()[index + 1]?.n ?? null);
  });

  private readonly ready = computed(() => this.load.status() === 'ready');
  readonly total = computed(() => (this.ready() ? this.views().length : null));
  readonly doneCount = computed(() => this.count('done'));
  readonly skippedCount = computed(() => this.count('skipped'));
  readonly pendingCount = computed(() => this.count('pending'));
  /** Every step is done or skipped. */
  readonly complete = computed(() => !!this.total() && this.pendingCount() === 0);

  constructor() {
    this.reload();
    this.destroyRef.onDestroy(() => {
      this.load.cancel();
      this.refreshing?.unsubscribe();
    });
  }

  /** First load (and retry): shows the first pending step. */
  reload(): void {
    this.load.run(
      this.service.status().pipe(
        tap((steps) => {
          this.steps.set(steps);
          if (!steps.some((step) => step.n === this.selected())) {
            this.selected.set(firstOpenStep(steps));
          }
        }),
      ),
    );
  }

  /**
   * Reads the steps again without leaving the current one: a step turns done as soon as the data shows it (after
   * saving the profile, adding a peer, switching a source, a successful scan…). A failure keeps what is shown. While
   * a mark is saved nothing is read, and an answer that started before a mark is dropped, so an older reading never
   * puts back the state the mark changed.
   */
  refresh(): void {
    if (this.marking() !== null) return;
    this.refreshing?.unsubscribe();
    const seen = this.marks;
    this.refreshing = this.service.status().subscribe({
      next: (steps) => {
        if (seen === this.marks) this.steps.set(steps);
      },
      error: () => undefined,
    });
  }

  select(n: number | null): void {
    if (n === null || n === this.selected()) return;
    this.selected.set(n);
    this.notice.set(null);
    this.markError.set(null);
    this.refresh();
  }

  /** Saves the mark of the current step; marking it done or skipped moves on to the next pending step. */
  mark(mark: StepMark): void {
    const n = this.selected();
    if (n === null || this.marking() !== null) return;
    this.marks += 1;
    this.refreshing?.unsubscribe();
    this.marking.set(n);
    this.markError.set(null);
    this.notice.set(null);
    this.service
      .mark(n, MARK_BODIES[mark])
      .pipe(
        finalize(() => this.marking.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (step) => {
          const steps = this.steps().map((known) => (known.n === step.n ? step : known));
          this.steps.set(steps);
          if (mark !== 'reset') {
            const following = nextOpenStep(steps, step.n);
            if (following !== null) this.selected.set(following);
          }
          this.notice.set(markNotice(step, mark));
        },
        error: (error: unknown) => this.markError.set(toApiError(error).message),
      });
  }

  private count(state: StepState): number | null {
    return this.ready() ? this.views().filter((step) => step.state === state).length : null;
  }
}
