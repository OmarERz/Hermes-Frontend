import type { ChangeRow } from '../../shared/versioned-save';
import type { CalibrationProposal, ConfigParameter } from './config-model';

/** Spanish names of the proposal kinds of `GET /api/calibration/proposals`; an unknown kind shows its code. */
const KIND_LABELS: Record<string, string> = {
  formula_weight: 'Peso de la fórmula',
  source_level: 'Nivel de una fuente',
  reason_threshold: 'Umbral de un motivo del juez',
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

export function proposalStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** A value of `previous_value` or `proposed_value` as text (objects as JSON, missing as —). */
function asText(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value as string | number);
}

/** The name of a changed key: the schema description when the key is a parameter, else a fixed name or the key. */
function keyName(
  key: string,
  proposal: CalibrationProposal,
  parameters: readonly ConfigParameter[],
): string {
  if (key === 'trust_tier') {
    const source = proposal.target_key?.replace(/^source:/, '');
    return source ? `Nivel de confianza de la fuente ${source}` : 'Nivel de confianza';
  }
  return parameters.find((param) => param.key === key)?.description ?? key;
}

/**
 * The before and after of a proposal, one row per key whose value changes (every key when none changes, so the
 * person always sees what the proposal touches). Weights are listed in the order of their keys.
 */
export function proposalChanges(
  proposal: CalibrationProposal,
  parameters: readonly ConfigParameter[] = [],
): ChangeRow[] {
  const before = proposal.previous_value ?? {};
  const after = proposal.proposed_value ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const rows = keys.map((key) => ({
    key,
    name: keyName(key, proposal, parameters),
    before: asText(before[key]),
    after: asText(after[key]),
  }));
  const changed = rows.filter((row) => row.before !== row.after);
  return (changed.length ? changed : rows).map(({ name, before: b, after: a }) => ({
    name,
    before: b,
    after: a,
  }));
}

/** What approving does, per kind (D-020: only an administrator's approval applies a proposal). */
export function approvalImpact(kind: string): string {
  if (kind === 'formula_weight') {
    return 'Se guarda como una versión nueva de la configuración y se recalculan las puntuaciones base sin llamar al juez.';
  }
  if (kind === 'source_level') {
    return 'Cambia el nivel de confianza de la fuente con sus reglas de siempre, y queda en la auditoría.';
  }
  return 'Se aplica el ajuste propuesto y queda en la auditoría.';
}

/** Two decimals of a numeric text of the backtest; other values as they come. */
function decimal(value: unknown): string {
  const number = Number(value);
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(number)
    ? number.toFixed(2)
    : asText(value);
}

/**
 * The 30-day replay of a weight proposal in one sentence: the mean error against the score people proposed,
 * before and after. Null when the proposal has no backtest; other shapes are listed as key: value.
 */
export function backtestSummary(backtest: CalibrationProposal['backtest']): string | null {
  if (!backtest || !Object.keys(backtest).length) return null;
  const { mae_before, mae_after, cases, window_days } = backtest;
  if (mae_before !== undefined && mae_after !== undefined) {
    const scope =
      cases !== undefined && window_days !== undefined
        ? ` (${asText(cases)} casos de los últimos ${asText(window_days)} días)`
        : '';
    return `Error medio: ${decimal(mae_before)} → ${decimal(mae_after)} puntos${scope}.`;
  }
  return Object.entries(backtest)
    .map(([key, value]) => `${key}: ${asText(value)}`)
    .join(' · ');
}
