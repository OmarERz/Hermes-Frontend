import { makeSource } from './source-fixtures';
import {
  capturedWithinDay,
  formatRefresh,
  levelsFor,
  refreshMinutes,
  Source,
  sourceText,
} from './source-labels';

/** A source with the optional F18.1 catalogue fields, which the published contract does not list yet. */
function withCatalogue(fields: Record<string, unknown>): Source {
  return { ...makeSource(), ...fields } as Source;
}

describe('source labels', () => {
  it('reads the optional catalogue fields only when they carry a value', () => {
    const source = withCatalogue({
      description: '  Vulnerabilidades explotadas.  ',
      provider: '   ',
      refresh_interval_minutes: 1440,
    });
    expect(sourceText(source, 'description')).toBe('Vulnerabilidades explotadas.');
    expect(sourceText(source, 'provider')).toBeNull();
    expect(refreshMinutes(source)).toBe(1440);
    expect(refreshMinutes(withCatalogue({ refresh_interval_minutes: 0 }))).toBeNull();
    expect(refreshMinutes(withCatalogue({ refresh_interval_minutes: 7.5 }))).toBeNull();
    expect(refreshMinutes(makeSource())).toBeNull();
  });

  it('says the refresh interval in Spanish', () => {
    expect(formatRefresh(null)).toBeNull();
    expect(formatRefresh(60)).toBe('Cada hora');
    expect(formatRefresh(1440)).toBe('Cada 24 horas');
    expect(formatRefresh(15)).toBe('Cada 15 minutos');
    expect(formatRefresh(1)).toBe('Cada minuto');
  });

  it('keeps N1 for structural sources and counts only captures of the last day', () => {
    expect(levelsFor({ structural: true })).toEqual(['N1', 'N2', 'N3', 'N4']);
    expect(levelsFor({ structural: false })).toEqual(['N2', 'N3', 'N4']);
    const now = Date.parse('2026-11-24T12:00:00Z');
    expect(capturedWithinDay(makeSource({ last_capture: '2026-11-24T00:00:00Z' }), now)).toBe(true);
    expect(capturedWithinDay(makeSource({ last_capture: '2026-11-22T00:00:00Z' }), now)).toBe(
      false,
    );
    expect(capturedWithinDay(makeSource({ last_capture: null }), now)).toBe(false);
    expect(capturedWithinDay(makeSource({ last_capture: 'no es fecha' }), now)).toBe(false);
  });
});
