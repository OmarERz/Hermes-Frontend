import { groupMetrics, METRIC_GROUPS, METRIC_HELP, metricValue } from './metric-groups';

describe('metric groups', () => {
  it('keeps the order of each section, whatever the order of the board', () => {
    const groups = groupMetrics([
      { key: 'noise_avoided', label: 'Ruido evitado', value: '4', unit: null },
      { key: 'precision', label: 'Precisión', value: '90.0', unit: '%' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].metrics.map((metric) => metric.key)).toEqual(['precision', 'noise_avoided']);
  });

  it('shows the value with its unit, as the backend formatted it', () => {
    expect(metricValue({ key: 'a', label: 'A', value: '3.5', unit: 'puntos' })).toBe('3.5 puntos');
    expect(metricValue({ key: 'b', label: 'B', value: '7', unit: null })).toBe('7');
  });

  it('has help for every metric it places, and places each key once', () => {
    const keys = METRIC_GROUPS.flatMap((group) => group.keys);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(METRIC_HELP[key]).toBeTruthy();
  });

  it('returns no section for an empty board', () => {
    expect(groupMetrics([])).toEqual([]);
  });
});
