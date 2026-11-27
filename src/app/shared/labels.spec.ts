import { formatDateTime, formatShortDateTime } from './labels';

describe('formatShortDateTime', () => {
  const now = new Date(2026, 10, 27, 12, 0);

  it('drops the year of the current one and keeps the clock of formatDateTime', () => {
    const iso = new Date(2026, 10, 27, 16, 9).toISOString();
    const short = formatShortDateTime(iso, now);
    expect(short).not.toContain('2026');
    expect(short).toMatch(/^27\snov,\s4:09\sp\.\s?m\.$/u);
    // The full form only adds the year.
    expect(formatDateTime(iso).replace(/\s2026/u, '')).toBe(short);
  });

  it('keeps the year of another one', () => {
    const iso = new Date(2025, 0, 5, 9, 30).toISOString();
    expect(formatShortDateTime(iso, now)).toMatch(/^5\sene\s2025,\s9:30\sa\.\s?m\.$/u);
  });

  it('shows a dash for a value that is not a date', () => {
    expect(formatShortDateTime('nope', now)).toBe('—');
  });
});
