import {
  approvalImpact,
  backtestSummary,
  kindLabel,
  proposalChanges,
  proposalStatusLabel,
} from './calibration-model';
import type { CalibrationProposal } from './config-model';
import { parameter } from './testing/config-fixtures';

function proposal(overrides: Partial<CalibrationProposal> = {}): CalibrationProposal {
  return {
    id: 'p1',
    created_at: '2026-11-20T08:00:00Z',
    kind: 'formula_weight',
    summary: 'Cambiar los pesos',
    status: 'pending',
    target_key: 'weights.P',
    previous_value: { 'weights.P': '0.30', 'weights.S': '0.25' },
    proposed_value: { 'weights.P': '0.35', 'weights.S': '0.25' },
    ...overrides,
  };
}

describe('calibration model', () => {
  it('names the kinds and statuses, keeping an unknown code', () => {
    expect(kindLabel('formula_weight')).toBe('Peso de la fórmula');
    expect(kindLabel('source_level')).toBe('Nivel de una fuente');
    expect(kindLabel('reason_threshold')).toBe('Umbral de un motivo del juez');
    expect(kindLabel('new_kind')).toBe('new_kind');
    expect(proposalStatusLabel('pending')).toBe('Pendiente');
    expect(proposalStatusLabel('approved')).toBe('Aprobada');
    expect(proposalStatusLabel('rejected')).toBe('Rechazada');
    expect(proposalStatusLabel('other')).toBe('other');
  });

  it('lists only the keys that change, named from the schema', () => {
    const params = [parameter({ key: 'weights.P', description: 'Peso del factor P' })];
    expect(proposalChanges(proposal(), params)).toEqual([
      { name: 'Peso del factor P', before: '0.30', after: '0.35' },
    ]);
  });

  it('lists every key when nothing changes and shows missing values as a dash', () => {
    expect(
      proposalChanges(
        proposal({ previous_value: { a: 1 }, proposed_value: { a: 1, b: { c: true } } }),
      ),
    ).toEqual([{ name: 'b', before: '—', after: '{"c":true}' }]);
    expect(
      proposalChanges(proposal({ previous_value: { a: '1' }, proposed_value: { a: '1' } })),
    ).toEqual([{ name: 'a', before: '1', after: '1' }]);
    expect(proposalChanges(proposal({ previous_value: null, proposed_value: null }))).toEqual([]);
  });

  it('names the trust tier after its source', () => {
    const level = proposal({
      kind: 'source_level',
      target_key: 'source:cisa_kev',
      previous_value: { trust_tier: 'N2' },
      proposed_value: { trust_tier: 'N1' },
    });
    expect(proposalChanges(level)).toEqual([
      { name: 'Nivel de confianza de la fuente cisa_kev', before: 'N2', after: 'N1' },
    ]);
    expect(proposalChanges({ ...level, target_key: undefined })[0].name).toBe('Nivel de confianza');
  });

  it('explains what approving does per kind', () => {
    expect(approvalImpact('formula_weight')).toContain('versión nueva');
    expect(approvalImpact('source_level')).toContain('nivel de confianza');
    expect(approvalImpact('reason_threshold')).toContain('auditoría');
  });

  it('summarizes the replay of a weight proposal', () => {
    expect(
      backtestSummary({ cases: 42, window_days: 30, mae_before: '6.1234', mae_after: '4.5' }),
    ).toBe('Error medio: 6.12 → 4.50 puntos (42 casos de los últimos 30 días).');
    expect(backtestSummary({ mae_before: 'n/a', mae_after: 3 })).toBe(
      'Error medio: n/a → 3 puntos.',
    );
    expect(backtestSummary({ hits: 3, misses: 1 })).toBe('hits: 3 · misses: 1');
    expect(backtestSummary({})).toBeNull();
    expect(backtestSummary(null)).toBeNull();
    expect(backtestSummary(undefined)).toBeNull();
  });
});
