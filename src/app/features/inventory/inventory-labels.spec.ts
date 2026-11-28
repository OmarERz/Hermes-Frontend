import {
  cpeParts,
  exposureLabel,
  formatDay,
  itopClassLabel,
  licenceValidity,
  percent,
  plural,
  text,
  yesNo,
} from './inventory-labels';
import { shareRows } from './inventory-view';

describe('inventory labels', () => {
  it('names the usual iTop classes in Spanish and keeps any other class as iTop names it', () => {
    expect(itopClassLabel('Server')).toBe('Servidor');
    expect(itopClassLabel('VirtualMachine')).toBe('Máquina virtual');
    expect(itopClassLabel('CustomAppliance')).toBe('CustomAppliance');
    expect(itopClassLabel(null)).toBe('Sin dato');
  });

  it('shows the nullable booleans of iTop and its free text without inventing a value', () => {
    expect(yesNo(true)).toBe('Sí');
    expect(yesNo(false)).toBe('No');
    expect(yesNo(null)).toBe('Sin dato');
    expect(exposureLabel(true)).toBe('Expuesto');
    expect(exposureLabel(false)).toBe('Interno');
    expect(exposureLabel(undefined)).toBe('Sin dato');
    expect(text('16 vCPU')).toBe('16 vCPU');
    expect(text('  ')).toBe('—');
    expect(text(null)).toBe('—');
  });

  it('formats a calendar day of iTop without shifting it to another day', () => {
    expect(formatDay('2026-12-31')).toContain('31');
    expect(formatDay('2026-12-31')).toContain('2026');
    expect(formatDay('mañana')).toBe('mañana');
    expect(formatDay(null)).toBe('—');
  });

  it('says how long a licence lasts from its dates', () => {
    expect(licenceValidity({ perpetual: true, start_date: null, end_date: null })).toBe('Perpetua');
    expect(
      licenceValidity({ perpetual: false, start_date: '2026-01-01', end_date: '2026-12-31' }),
    ).toMatch(/^Del .+ al .+$/);
    expect(licenceValidity({ perpetual: false, start_date: null, end_date: '2026-12-31' })).toMatch(
      /^Vence el /,
    );
    expect(licenceValidity({ perpetual: false, start_date: '2026-01-01', end_date: null })).toMatch(
      /sin vencimiento en iTop$/,
    );
    expect(licenceValidity({ perpetual: false, start_date: null, end_date: null })).toBe(
      'Sin fechas en iTop',
    );
  });

  it('counts and shares', () => {
    expect(plural(1, 'instalación', 'instalaciones')).toBe('1 instalación');
    expect(plural(3, 'instalación', 'instalaciones')).toBe('3 instalaciones');
    expect(percent(1, 3)).toBe(33);
    expect(percent(1, 0)).toBe(0);
  });

  it('cuts a CPE after each colon only', () => {
    expect(cpeParts('cpe:2.3:a:f5:nginx:*')).toEqual(['cpe:', '2.3:', 'a:', 'f5:', 'nginx:', '*']);
    expect(cpeParts(null)).toEqual([]);
    expect(cpeParts('')).toEqual([]);
  });

  it('builds distribution rows in a fixed order or from the largest count', () => {
    expect(shareRows({ b: 1, a: 3 }, (key) => key.toUpperCase())).toEqual([
      { key: 'a', label: 'A', total: 3, percent: 75 },
      { key: 'b', label: 'B', total: 1, percent: 25 },
    ]);
    expect(shareRows({ high: 2 }, (key) => key, ['high', 'low'])).toEqual([
      { key: 'high', label: 'high', total: 2, percent: 100 },
      { key: 'low', label: 'low', total: 0, percent: 0 },
    ]);
  });
});
