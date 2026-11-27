import { Component, computed, DestroyRef, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VERDICT_LABELS } from '../recommendations/feedback';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { formatDateTime } from '../../shared/labels';
import {
  labelOf,
  MITIGATION_LABELS,
  REASON_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
} from './agent-labels';
import { AgentsService, FeedbackEntry, JudgeDetail, JudgeReason } from './agents.service';
import { formatSigned } from './formatting';

function viewState(state: AsyncState<unknown>): ViewState | null {
  const status = state.status();
  if (status === 'ready') return null;
  return status === 'error' ? 'error' : 'loading';
}

/** A reason of the judge for people: its points (applied if accepted, proposed if not) and where it applies. */
export function reasonLine(reason: JudgeReason) {
  return {
    seq: reason.seq,
    label: reason.label,
    points: `${formatSigned(reason.points)} puntos`,
    status: labelOf(REASON_STATUS_LABELS, reason.status),
    rule: reason.rejection_rule,
    ciId: reason.ci_id,
    quote: reason.quote,
  };
}

/** The adjustment of the judge: proposed against applied, and whether the dead zone stopped it. */
export function adjustmentText(detail: JudgeDetail): string {
  const parts: string[] = [];
  if (detail.proposed_adjustment !== null) {
    parts.push(`Propuesto ${formatSigned(detail.proposed_adjustment)}`);
  }
  parts.push(
    `${parts.length ? 'aplicado' : 'Aplicado'} ${formatSigned(detail.applied_adjustment)}`,
  );
  const text = parts.join(' · ');
  return detail.dead_zone_applied ? `${text} (cayó en la zona muerta y no se aplicó)` : text;
}

/** The blind double review, when there was one. */
export function doubleReviewText(detail: JudgeDetail): string {
  const double = detail.double_review;
  if (!double) return 'No hubo';
  const outcome =
    double.agreed === null
      ? 'Sin decidir (la revisión quedó obsoleta)'
      : double.agreed
        ? 'Coincidieron'
        : 'No coincidieron: final = base';
  const adjustment = (value: number | null) =>
    value === null ? 'sin ajuste' : formatSigned(value);
  return (
    `${outcome} · primera ${adjustment(double.first_adjustment)} · ` +
    `segunda ${adjustment(double.second_adjustment)} (${labelOf(REVIEW_STATUS_LABELS, double.second_status)})`
  );
}

/**
 * Decision of the judge for one evaluation (HI-6, HI-7, FRO-13) from `GET /api/recommendations/{id}/judge`, and the
 * feedback people gave on it (HI-8, `GET /api/recommendations/{id}/feedback`). Quotes are external text: they are
 * shown as data, escaped (SEG-02). The judge never acts: its adjustment only reaches the score through validation.
 */
@Component({
  selector: 'app-judge-review',
  imports: [RouterLink, AsyncStateComponent],
  templateUrl: './judge-review.html',
  styleUrl: './judge-review.css',
})
export class JudgeReview {
  private readonly service = inject(AgentsService);

  readonly assessmentId = input.required<string>();

  readonly judge = new AsyncState<JudgeDetail>();
  readonly feedback = new AsyncState<FeedbackEntry[]>();

  readonly judgeState = computed(() => viewState(this.judge));
  readonly feedbackState = computed(() => viewState(this.feedback));

  readonly detail = computed(() => (this.judge.status() === 'ready' ? this.judge.value() : null));
  readonly accepted = computed(() => (this.detail()?.accepted_reasons ?? []).map(reasonLine));
  readonly rejected = computed(() => (this.detail()?.rejected_reasons ?? []).map(reasonLine));
  readonly facts = computed(() => {
    const detail = this.detail();
    if (!detail) return [];
    return [
      {
        term: 'Resultado',
        value: detail.status
          ? labelOf(REVIEW_STATUS_LABELS, detail.status)
          : 'La evaluación no tuvo juez',
      },
      { term: 'Resumen', value: detail.summary ?? '—' },
      { term: 'Modelo', value: detail.model ?? '—' },
      {
        term: 'Revisado',
        value: detail.reviewed_at ? formatDateTime(detail.reviewed_at) : '—',
      },
      { term: 'Ajuste', value: adjustmentText(detail) },
      { term: 'Doble revisión', value: doubleReviewText(detail) },
      { term: 'Mitigación', value: labelOf(MITIGATION_LABELS, detail.mitigation_status) },
    ];
  });

  readonly feedbackLines = computed(() =>
    (this.feedback.status() === 'ready' ? (this.feedback.value() ?? []) : []).map((entry) => ({
      who: entry.user,
      verdict: labelOf(VERDICT_LABELS, entry.verdict),
      when: formatDateTime(entry.created_at),
      active: entry.active,
      olderVersion: entry.on_older_version,
      channel: entry.channel === 'slack' ? 'Slack' : 'front',
    })),
  );

  constructor() {
    // A new evaluation (another event selected) loads its own judge detail and feedback.
    effect(() => {
      this.assessmentId();
      untracked(() => {
        this.loadJudge();
        this.loadFeedback();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.judge.cancel();
      this.feedback.cancel();
    });
  }

  loadJudge(): void {
    this.judge.run(this.service.judge(this.assessmentId()));
  }

  loadFeedback(): void {
    this.feedback.run(this.service.feedback(this.assessmentId()));
  }
}
