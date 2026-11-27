import { dayBound } from './day-bound';

describe('dayBound', () => {
  it('gives the start and the end of the local day as UTC instants', () => {
    expect(dayBound('2026-11-20', false)).toBe(new Date(2026, 10, 20, 0, 0, 0, 0).toISOString());
    expect(dayBound('2026-11-20', true)).toBe(
      new Date(2026, 10, 20, 23, 59, 59, 999).toISOString(),
    );
  });

  it('leaves the filter out for an empty or malformed day', () => {
    expect(dayBound('', false)).toBeNull();
    expect(dayBound('20/11/2026', true)).toBeNull();
    expect(dayBound('2026-11-20T00:00', false)).toBeNull();
  });
});
