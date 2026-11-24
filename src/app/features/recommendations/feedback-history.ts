import { Component, computed, DestroyRef, effect, inject, input, untracked } from '@angular/core';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { formatDateTime, LEVEL_LABELS } from '../../shared/labels';
import { VERDICT_LABELS, type FeedbackEntry, type Verdict } from './feedback';
import { RecommendationsService } from './recommendations.service';

const CHANNEL_LABELS: Record<FeedbackEntry['channel'], string> = {
  frontend: 'Front',
  slack: 'Slack',
};

/**
 * Feedback history of one evaluation (FRO-13, FRO-15): every feedback from the front and from Slack, the current
 * one of each person marked «Vigente», and the ones given on an older version of the evaluation flagged. The comment
 * is the person's text: shown as data (interpolated, so escaped).
 */
@Component({
  selector: 'app-feedback-history',
  imports: [AsyncStateComponent],
  template: `
    <section class="feedback-history" aria-label="Historial de feedback">
      @if (viewState(); as state) {
        <app-async-state
          [state]="state"
          [error]="history.error()"
          loadingText="Cargando el feedback…"
          emptyText="Nadie ha dado feedback sobre esta evaluación."
          (retry)="load()"
        />
      } @else {
        <ol>
          @for (entry of rows(); track $index) {
            <li [class.current]="entry.active">
              <p class="entry-heading">
                <strong>{{ entry.verdictLabel }}</strong>
                <span>{{ entry.user }} · {{ entry.channelLabel }} · {{ entry.date }}</span>
                @if (entry.active) {
                  <span class="entry-badge">Vigente</span>
                }
                @if (entry.on_older_version) {
                  <span class="entry-badge muted">Sobre una versión anterior</span>
                }
              </p>
              @if (entry.levelLabel) {
                <p>
                  Nivel propuesto: {{ entry.levelLabel }}
                  @if (entry.proposed_score !== null) {
                    · puntaje propuesto: {{ entry.proposed_score }}
                  }
                </p>
              }
              @if (entry.comment) {
                <p class="entry-comment">{{ entry.comment }}</p>
              }
            </li>
          }
        </ol>
      }
    </section>
  `,
  styleUrl: './feedback-history.css',
})
export class FeedbackHistory {
  private readonly service = inject(RecommendationsService);

  readonly assessmentId = input.required<string>();
  /** Bumped by the page after a feedback is saved, to read the history again. */
  readonly revision = input(0);

  readonly history = new AsyncState<FeedbackEntry[]>();

  readonly rows = computed(() =>
    (this.history.value() ?? []).map((entry) => ({
      ...entry,
      verdictLabel: VERDICT_LABELS[entry.verdict as Verdict] ?? entry.verdict,
      channelLabel: CHANNEL_LABELS[entry.channel] ?? entry.channel,
      levelLabel: entry.proposed_level ? LEVEL_LABELS[entry.proposed_level] : null,
      date: formatDateTime(entry.created_at),
    })),
  );

  readonly viewState = computed<ViewState | null>(() => {
    const status = this.history.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.rows().length ? null : 'empty';
  });

  constructor() {
    effect(() => {
      this.assessmentId();
      this.revision();
      untracked(() => this.load());
    });
    inject(DestroyRef).onDestroy(() => this.history.cancel());
  }

  load(): void {
    this.history.run(this.service.feedback(this.assessmentId()));
  }
}
