import { Component, computed, input, output, signal } from '@angular/core';
import { LucideGitCompareArrows } from '@lucide/angular';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { ACTION_ROLES } from '../../core/auth/roles';
import { Chip } from '../../shared/chip';
import { ItopLink } from '../../shared/itop-links';
import {
  CLASSIFICATION_LABELS,
  criticalityLabel,
  formatDateTime,
  LEVEL_LABELS,
  STATUS_LABELS,
} from '../../shared/labels';
import { ticketItopId, type Recommendation } from './feedback';
import { FeedbackHistory } from './feedback-history';
import { JudgeDetail } from './judge-detail';

/** A score change with its sign, as FRO-13 writes it (`Juez +12`). */
export function signed(points: number): string {
  return points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0';
}

/**
 * One evaluation (FRO-13): base, judge adjustment and final with the change against the previous evaluation
 * (RE-4, RE-5), the justification, the mitigation from the data and the steps drafted by the AI (labelled «IA»),
 * the affected asset with its classification at evaluation time, the ticket, the judge detail and the feedback
 * received, with its history on demand.
 */
@Component({
  selector: 'app-recommendation-card',
  imports: [Chip, FeedbackHistory, IfRoleDirective, ItopLink, JudgeDetail, LucideGitCompareArrows],
  templateUrl: './recommendation-card.html',
  styleUrl: './recommendation-card.css',
})
export class RecommendationCard {
  readonly recommendation = input.required<Recommendation>();
  /** Bumped by the page after a feedback is saved, so an open history reads it again. */
  readonly historyRevision = input(0);

  /** «Dar feedback»: only analyst or admin see it (`*appIfRole`); the page opens the feedback dialog. */
  readonly giveFeedback = output<void>();

  readonly feedbackRole = ACTION_ROLES.giveFeedback;
  readonly historyOpen = signal(false);

  readonly levelLabels = LEVEL_LABELS;
  readonly signed = signed;

  readonly createdAt = computed(() => formatDateTime(this.recommendation().created_at));
  readonly ticketId = computed(() => ticketItopId(this.recommendation()));

  readonly feedbackSummary = computed(() => {
    const count = this.recommendation().feedback_count;
    if (count === 0) return 'Sin feedback todavía.';
    return count === 1 ? '1 feedback vigente.' : `${count} feedbacks vigentes.`;
  });

  /** Change of the final against the previous evaluation (↑↓, FRO-13), or null when there was none. */
  readonly trend = computed(() => {
    const { final, previous_final: previous } = this.recommendation();
    if (previous === null) return null;
    const change = final - previous;
    if (change === 0) return { arrow: '=', text: 'Sin cambio' };
    return change > 0
      ? { arrow: '↑', text: `Sube ${change}` }
      : { arrow: '↓', text: `Baja ${Math.abs(change)}` };
  });

  readonly asset = computed(() => {
    const asset = this.recommendation().asset;
    if (!asset) return null;
    const atEvaluation = CLASSIFICATION_LABELS[asset.classification_at_evaluation];
    const today = CLASSIFICATION_LABELS[asset.classification];
    return {
      ...asset,
      criticalityLabel: criticalityLabel(asset.criticality),
      classificationLabel: atEvaluation,
      classificationToday:
        asset.classification === asset.classification_at_evaluation ? null : today,
      statusLabel: STATUS_LABELS[asset.finding_status],
    };
  });
}
