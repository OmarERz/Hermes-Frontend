import { historyChart, waterfallChart, waterfallSteps } from './score-charts';

describe('waterfallSteps', () => {
  it('goes from raw through the non-zero bars, in order, to the final of the backend', () => {
    const steps = waterfallSteps({
      assessment_id: 'a1',
      ci_id: 'SRV-01',
      raw: 60,
      final: 92,
      waterfall: {
        judge: 5,
        P: 20,
        T: 0,
        A: 8,
        D: -1,
        rounding: 0,
        floor: 0,
        clamp: 0,
        version: 0,
      },
    });
    expect(steps.map((step) => [step.key, step.from, step.to])).toEqual([
      ['raw', 0, 60],
      ['P', 60, 80],
      ['A', 80, 88],
      ['D', 88, 87],
      ['judge', 87, 92],
      ['final', 0, 92],
    ]);
    expect(steps.map((step) => step.label)).toEqual([
      'Crudo (100 × S)',
      'Explotación',
      'Criticidad y exposición del activo',
      'Sensibilidad de los datos',
      'Ajuste del juez',
      'Final',
    ]);
  });

  it('keeps bars it does not know, after the known ones, with their key as label', () => {
    const steps = waterfallSteps({
      assessment_id: 'a1',
      raw: null,
      final: 10,
      waterfall: { new_factor: 4, P: 6 },
    });
    expect(steps.map((step) => step.label)).toEqual([
      'Crudo (100 × S)',
      'Explotación',
      'new_factor',
      'Final',
    ]);
  });
});

describe('chart options', () => {
  it('draws totals in violet, increases in pink and decreases in green', () => {
    const steps = waterfallSteps({
      assessment_id: 'a1',
      raw: 50,
      final: 45,
      waterfall: { P: 5, judge: -10 },
    });
    const option = waterfallChart(steps) as { series: { data: unknown[] }[] };
    const visible = option.series[1].data as { value: number; itemStyle: { color: string } }[];
    expect(visible.map((bar) => [bar.value, bar.itemStyle.color])).toEqual([
      [50, '#9844df'],
      [5, '#ed079b'],
      [10, '#2bb673'],
      [45, '#9844df'],
    ]);
    expect(option.series[0].data).toEqual([0, 50, 45, 0]);
  });

  it('plots final and base for each assessment', () => {
    const option = historyChart([
      { date: '2026-11-20T10:00:00Z', base: 70, judge_adjustment: 5, final: 75 },
    ]) as { series: { name: string; data: number[] }[] };
    expect(option.series.map((series) => [series.name, series.data])).toEqual([
      ['Final', [75]],
      ['Base', [70]],
    ]);
  });
});
