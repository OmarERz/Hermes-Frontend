import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Subscription } from 'rxjs';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideBot,
  LucideCheck,
  LucideMessageSquareText,
  LucideUserRoundCheck,
  LucideX,
} from '@lucide/angular';
import { toApiError } from '../../core/api/api-error';
import { AsyncState } from '../../shared/async-state';
import { formatDateTime, LEVEL_LABELS, type Level } from '../../shared/labels';
import {
  ACCEPT_ORIGINAL,
  acceptOriginalProblem,
  COMMENT_MAX_LENGTH,
  levelOfScore,
  shiftLevel,
  ticketItopId,
  toFeedbackRequest,
  VERDICT_HINTS,
  VERDICT_LABELS,
  VERDICTS,
  type FeedbackChoice,
  type FeedbackResult,
  type LevelBands,
  type Recommendation,
} from './feedback';
import { signed } from './recommendation-card';
import { RecommendationsService } from './recommendations.service';

/** The decisions the panel offers: the five verdicts and «Aceptar puntaje original» (RE-9). */
const OPTIONS: readonly { value: FeedbackChoice; label: string; hint: string }[] = [
  ...VERDICTS.map((verdict) => ({
    value: verdict,
    label: VERDICT_LABELS[verdict],
    hint: VERDICT_HINTS[verdict],
  })),
  {
    value: ACCEPT_ORIGINAL,
    label: 'Aceptar puntaje original',
    hint: 'Descarta el ajuste del juez: se envía como «Prioridad incorrecta» con el puntaje base.',
  },
];

/**
 * «Revisión humana» reconverted to feedback (FRO-14, FRO-15, RE-7 to RE-9): the person picks a verdict, moves the
 * level one step per click with the arrows («Prioridad incorrecta»), may add a score from 0 to 100 and a comment,
 * and the backend records it with `POST /api/feedback` (analyst or admin; the page only renders it for them). It
 * never changes the score nor the ticket. Same dialog design as the prototype (`review-modal`).
 */
@Component({
  selector: 'app-feedback-dialog',
  imports: [
    FormsModule,
    LucideArrowDown,
    LucideArrowUp,
    LucideBot,
    LucideCheck,
    LucideMessageSquareText,
    LucideUserRoundCheck,
    LucideX,
  ],
  templateUrl: './feedback-dialog.html',
  styleUrl: './feedback-dialog.css',
})
export class FeedbackDialog {
  private readonly service = inject(RecommendationsService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialogElement');

  readonly recommendation = input.required<Recommendation>();
  readonly closed = output<void>();
  readonly saved = output<FeedbackResult>();

  readonly options = OPTIONS;
  readonly acceptOriginalValue = ACCEPT_ORIGINAL;
  readonly levelLabels = LEVEL_LABELS;
  readonly commentMaxLength = COMMENT_MAX_LENGTH;
  readonly signed = signed;

  readonly choice = signal<FeedbackChoice | null>(null);
  readonly proposedLevel = signal<Level | null>(null);
  readonly proposedScore = signal<number | null>(null);
  readonly comment = signal('');
  readonly problem = signal('');

  readonly bands = new AsyncState<LevelBands | null>();
  readonly sending = signal(false);
  private sendSubscription: Subscription | null = null;

  /** The level the arrows show: the proposed one, or the current one before the first click. */
  readonly shownLevel = computed(() => this.proposedLevel() ?? this.recommendation().level);
  readonly ticketId = computed(() => ticketItopId(this.recommendation()));
  readonly createdAt = computed(() => formatDateTime(this.recommendation().created_at));

  /** What «Aceptar puntaje original» would send, or why it cannot (RE-9). */
  readonly acceptOriginal = computed(() => {
    const recommendation = this.recommendation();
    if (this.bands.loading()) return { pending: true, problem: null, level: null };
    const bands = this.bands.value();
    const problem = acceptOriginalProblem(recommendation, bands);
    const level = !problem && bands ? LEVEL_LABELS[levelOfScore(recommendation.base, bands)] : null;
    return { pending: false, problem, level };
  });

  readonly dirty = computed(
    () =>
      this.choice() !== null ||
      this.proposedLevel() !== null ||
      this.proposedScore() !== null ||
      this.comment().trim() !== '',
  );

  private done = false;

  constructor() {
    this.bands.run(this.service.levelBands());
    afterNextRender(() => this.show());
    inject(DestroyRef).onDestroy(() => {
      this.bands.cancel();
      this.sendSubscription?.unsubscribe();
    });
  }

  choose(choice: FeedbackChoice): void {
    this.choice.set(choice);
    this.problem.set('');
  }

  /** One click of an arrow: one level from the one shown (FRO-14). */
  move(direction: 'up' | 'down'): void {
    this.proposedLevel.set(shiftLevel(this.shownLevel(), direction));
    this.problem.set('');
  }

  save(): void {
    if (this.sending()) return;
    if (this.choice() === ACCEPT_ORIGINAL && this.bands.loading()) {
      this.problem.set('Todavía se están leyendo los niveles de la configuración.');
      return;
    }
    const outcome = toFeedbackRequest(
      this.recommendation(),
      {
        choice: this.choice(),
        proposedLevel: this.proposedLevel(),
        proposedScore: this.proposedScore(),
        comment: this.comment(),
      },
      this.bands.value(),
    );
    if (!outcome.ok) {
      this.problem.set(outcome.problem);
      return;
    }
    this.problem.set('');
    this.sending.set(true);
    this.sendSubscription = this.service.send(outcome.request).subscribe({
      next: (result) => {
        this.sending.set(false);
        this.saved.emit(result);
        this.finish();
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.problem.set(toApiError(error).message);
      },
    });
  }

  /** Closes after asking, when there is an unsaved decision (as the prototype did); never mid-save. */
  close(): void {
    if (this.sending()) return;
    if (this.dirty() && !window.confirm('Hay un feedback sin guardar. ¿Cerrar y descartarlo?')) {
      return;
    }
    this.finish();
  }

  /** Escape closes through the same confirmation. */
  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  /**
   * The browser closed the modal on its own (it may skip the cancelable `cancel` event, for example on a second
   * Escape): the same rules as `close()` apply, so it opens again while saving or when the person keeps the draft.
   */
  onNativeClose(): void {
    if (this.done) return;
    if (
      this.sending() ||
      (this.dirty() && !window.confirm('Hay un feedback sin guardar. ¿Cerrar y descartarlo?'))
    ) {
      this.show();
      return;
    }
    this.finish();
  }

  /** Emits `closed` once, after a save or a confirmed close. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    const dialog = this.dialog()?.nativeElement;
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    this.closed.emit();
  }

  private show(): void {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
}
