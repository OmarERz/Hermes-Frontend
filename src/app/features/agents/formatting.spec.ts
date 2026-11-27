import {
  dayBoundary,
  formatCount,
  formatDay,
  formatDuration,
  formatHours,
  formatLatency,
  formatPercent,
  formatSigned,
  formatUsd,
  NO_DATA,
} from './formatting';

describe('telemetry formatting', () => {
  it('formats counts and leaves a missing count as «Sin datos»', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(null)).toBe(NO_DATA);
    expect(formatCount(undefined)).toBe(NO_DATA);
  });

  it('shows a percentage text as given, with its sign', () => {
    expect(formatPercent('93.5')).toBe('93.5 %');
    expect(formatPercent(null)).toBe(NO_DATA);
    expect(formatPercent('')).toBe(NO_DATA);
  });

  it('formats dollars, keeping four decimals below one dollar', () => {
    expect(formatUsd('0.004213')).toContain('0.0042');
    expect(formatUsd('12.5')).toContain('12.50');
    expect(formatUsd('5')).toContain('5.00');
    expect(formatUsd('not-a-number')).toBe('not-a-number');
    expect(formatUsd(null)).toBe(NO_DATA);
    expect(formatUsd('')).toBe(NO_DATA);
  });

  it('formats latencies in milliseconds or seconds', () => {
    expect(formatLatency(850)).toBe('850 ms');
    expect(formatLatency(2450)).toBe('2.5 s');
    expect(formatLatency(null)).toBe(NO_DATA);
  });

  it('formats durations in seconds, minutes and hours', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(125)).toBe('2 min 5 s');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3900)).toBe('1 h 5 min');
    expect(formatDuration(null)).toBe('Sin terminar');
  });

  it('formats hours and UTC days', () => {
    expect(formatHours('30.5')).toBe('30.5 h');
    expect(formatHours(null)).toBe(NO_DATA);
    expect(formatDay('2026-11-27')).toBe('27 nov');
    expect(formatDay('bad')).toBe('bad');
  });

  it('signs whole numbers', () => {
    expect(formatSigned(5)).toBe('+5');
    expect(formatSigned(-3)).toBe('−3');
    expect(formatSigned(0)).toBe('0');
  });

  it('turns a date filter into the start or the end of that day in local time', () => {
    expect(dayBoundary('2026-11-27', 'from')).toBe(
      new Date(2026, 10, 27, 0, 0, 0, 0).toISOString(),
    );
    expect(dayBoundary('2026-11-27', 'to')).toBe(
      new Date(2026, 10, 27, 23, 59, 59, 999).toISOString(),
    );
    expect(dayBoundary('', 'from')).toBeNull();
    expect(dayBoundary('27/11/2026', 'to')).toBeNull();
  });
});
