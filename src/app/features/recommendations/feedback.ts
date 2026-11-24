import type { ApiBody, ApiSchema } from '../../core/api/api-client';
import { LEVELS, type Level } from '../../shared/labels';

/**
 * Feedback on a recommendation (FRO-14, FRO-15): the five verdicts of `POST /api/feedback`, the level arrows, the
 * optional score and comment, and «Aceptar puntaje original» (RE-9, D-088). Feedback never changes the score by
 * itself and never touches the ticket: the backend records it and the calibration reads it.
 */

export type Recommendation = ApiSchema<'Recommendation'>;
export type FeedbackEntry = ApiSchema<'FeedbackEntry'>;
export type FeedbackRequest = ApiBody<'/api/feedback', 'post'>;
export type FeedbackResult = ApiSchema<'FeedbackResult'>;
export type Verdict = FeedbackRequest['verdict'];

/** Spanish names of the verdicts, in the order the panel offers them (FRO-14). */
export const VERDICT_LABELS: Record<Verdict, string> = {
  relevant: 'Relevante',
  false_positive: 'Falso positivo',
  wrong_priority: 'Prioridad incorrecta',
  investigating: 'Investigando',
  stop_suggestions: 'No sugerir más',
};

/** What each verdict means, from the OpenAPI descriptions of `FeedbackRequest.verdict`. */
export const VERDICT_HINTS: Record<Verdict, string> = {
  relevant: 'La recomendación es útil.',
  false_positive: 'No aplica: suprime los hallazgos evaluados hasta que cambien.',
  wrong_priority: 'Propón otro nivel con las flechas y, si quieres, un puntaje de 0 a 100.',
  investigating: 'Se está investigando.',
  stop_suggestions: 'No sugerir más en el ticket.',
};

export const VERDICTS = Object.keys(VERDICT_LABELS) as Verdict[];

/** «Aceptar puntaje original» (RE-9): sent as `wrong_priority` proposing the base score and its level (D-088). */
export const ACCEPT_ORIGINAL = 'accept_original';
export type FeedbackChoice = Verdict | typeof ACCEPT_ORIGINAL;

/** The person's answer while it is being written. */
export interface FeedbackDraft {
  choice: FeedbackChoice | null;
  proposedLevel: Level | null;
  proposedScore: number | null;
  comment: string;
}

/** Longest comment the API accepts (`FeedbackRequest.comment`). */
export const COMMENT_MAX_LENGTH = 2000;

const TICKET_ID = /^[0-9]{1,12}$/;

/** The urgency of each level in iTop and in the configuration bands (`bands.1` is the critical one). */
const URGENCY: Record<Level, number> = { critical: 1, high: 2, medium: 3, low: 4 };

/** Minimum score of each level, from the configuration (`bands.1` … `bands.4`, GET /api/config). */
export type LevelBands = Record<Level, number>;

/** The level bands of the configuration values, or null when one is missing or is not a score. */
export function parseLevelBands(values: Readonly<Record<string, string>>): LevelBands | null {
  const bands: Partial<LevelBands> = {};
  for (const level of LEVELS) {
    const raw = values[`bands.${URGENCY[level]}`]?.trim() ?? '';
    const minimum = Number(raw);
    if (!raw || !Number.isInteger(minimum) || minimum < 0 || minimum > 100) return null;
    bands[level] = minimum;
  }
  return bands as LevelBands;
}

/** The level of a score with the configured bands: the first level whose minimum it reaches (EVA, TIC-03). */
export function levelOfScore(score: number, bands: LevelBands): Level {
  return LEVELS.find((level) => score >= bands[level]) ?? 'low';
}

/** One click of the arrows (FRO-14): one level more urgent (`up`) or less urgent (`down`), within the scale. */
export function shiftLevel(level: Level, direction: 'up' | 'down'): Level {
  const index = LEVELS.indexOf(level) + (direction === 'up' ? -1 : 1);
  return LEVELS[Math.min(Math.max(index, 0), LEVELS.length - 1)];
}

/**
 * The iTop id of the ticket the recommendation shows (the one of the shown CI's custodian), so that «Falso
 * positivo» and «No sugerir más» only affect that ticket (FRONTEND.md §5, TIC-07). The current contract only
 * carries the ticket link (`…/pages/UI.php?operation=details&class=UserRequest&id=<n>`), so the id is read from it;
 * anything that is not a plain iTop id is dropped and the feedback applies to every ticket of the evaluation.
 */
export function ticketItopId(recommendation: Pick<Recommendation, 'ticket_url'>): string | null {
  const url = recommendation.ticket_url;
  if (!url) return null;
  try {
    const id = new URL(url).searchParams.get('id');
    return id && TICKET_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

const NO_BANDS =
  'No se pudieron leer los niveles de la configuración; inténtalo de nuevo más tarde.';

/** Why «Aceptar puntaje original» cannot be sent for this recommendation, or null when it can. */
export function acceptOriginalProblem(
  recommendation: Pick<Recommendation, 'judge_adjustment'>,
  bands: LevelBands | null,
): string | null {
  if (recommendation.judge_adjustment === 0) {
    return 'El juez no ajustó este puntaje: no hay un puntaje original distinto que aceptar.';
  }
  return bands ? null : NO_BANDS;
}

export type FeedbackOutcome =
  { ok: true; request: FeedbackRequest } | { ok: false; problem: string };

/**
 * Checks the draft and builds the body of `POST /api/feedback`. The user and the channel come from the token,
 * never from the body. `ticket_itop_id` goes whenever the recommendation shows a ticket.
 */
export function toFeedbackRequest(
  recommendation: Recommendation,
  draft: FeedbackDraft,
  bands: LevelBands | null,
): FeedbackOutcome {
  const comment = draft.comment.trim();
  if (comment.length > COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      problem: `El comentario admite hasta ${COMMENT_MAX_LENGTH} caracteres.`,
    };
  }
  let request: FeedbackRequest;
  switch (draft.choice) {
    case null:
      return { ok: false, problem: 'Elige un veredicto.' };
    case ACCEPT_ORIGINAL: {
      const problem = acceptOriginalProblem(recommendation, bands);
      if (problem !== null || bands === null) return { ok: false, problem: problem ?? NO_BANDS };
      request = {
        assessment_id: recommendation.assessment_id,
        verdict: 'wrong_priority',
        proposed_level: levelOfScore(recommendation.base, bands),
        proposed_score: recommendation.base,
      };
      break;
    }
    case 'wrong_priority': {
      if (!draft.proposedLevel || draft.proposedLevel === recommendation.level) {
        return {
          ok: false,
          problem: 'Usa las flechas para proponer un nivel distinto del actual.',
        };
      }
      const score = draft.proposedScore;
      if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) {
        return {
          ok: false,
          problem: 'El puntaje propuesto debe ser un número entero de 0 a 100.',
        };
      }
      request = {
        assessment_id: recommendation.assessment_id,
        verdict: 'wrong_priority',
        proposed_level: draft.proposedLevel,
        ...(score === null ? {} : { proposed_score: score }),
      };
      break;
    }
    default:
      request = { assessment_id: recommendation.assessment_id, verdict: draft.choice };
  }
  const ticket = ticketItopId(recommendation);
  if (ticket) request.ticket_itop_id = ticket;
  if (comment) request.comment = comment;
  return { ok: true, request };
}
