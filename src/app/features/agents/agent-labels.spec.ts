import {
  HISTORY_STATUS_OPTIONS,
  historyStatusLabel,
  labelOf,
  REVIEW_MODE_LABELS,
  REVIEW_STATUS_LABELS,
} from './agent-labels';

describe('agent labels', () => {
  it('names a history status by its event type', () => {
    expect(historyStatusLabel('config_change', 'applied')).toBe('Aplicado');
    expect(historyStatusLabel('llm_review', 'applied')).toBe('Aplicada');
    expect(historyStatusLabel('run', 'succeeded')).toBe('Terminó bien');
    expect(historyStatusLabel('run', 'cancelled')).toBe('cancelled');
    expect(historyStatusLabel('llm_review', 'no_judge_review')).toBe('Sin juez (respaldo)');
  });

  it('guesses the meaning of a status without a type', () => {
    expect(historyStatusLabel(null, 'failed')).toBe('Terminó con error');
    expect(historyStatusLabel(null, 'applied')).toBe('Aplicada');
    expect(historyStatusLabel(null, 'something_new')).toBe('something_new');
    expect(historyStatusLabel('llm_review', 'running')).toBe('En ejecución');
  });

  it('offers the statuses of each event type', () => {
    expect(HISTORY_STATUS_OPTIONS.run).toEqual(['queued', 'running', 'succeeded', 'failed']);
    expect(HISTORY_STATUS_OPTIONS.llm_review).toEqual(Object.keys(REVIEW_STATUS_LABELS));
    expect(HISTORY_STATUS_OPTIONS.config_change).toEqual(['applied']);
  });

  it('falls back to the raw value for an unknown enum value and a dash for none', () => {
    expect(labelOf(REVIEW_MODE_LABELS, 'scoring')).toBe('Puntuación (modo 1)');
    expect(labelOf(REVIEW_MODE_LABELS, 'calibration')).toBe('calibration');
    expect(labelOf(REVIEW_MODE_LABELS, null)).toBe('—');
    expect(labelOf(REVIEW_MODE_LABELS, '')).toBe('—');
  });
});
