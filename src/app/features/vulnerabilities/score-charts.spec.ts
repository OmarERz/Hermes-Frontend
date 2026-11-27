import { historyChart, waterfallChart, waterfallRange, waterfallSteps } from './score-charts';

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

  it('widens the axis so a step past 100 and the clamp that brings it back are drawn whole', () => {
    const steps = waterfallSteps({
      assessment_id: 'a1',
      raw: 95,
      final: 100,
      waterfall: { P: 10, clamp: -5 },
    });
    expect(steps.map((step) => [step.key, step.from, step.to])).toEqual([
      ['raw', 0, 95],
      ['P', 95, 105],
      ['clamp', 105, 100],
      ['final', 0, 100],
    ]);
    const option = waterfallChart(steps) as {
      yAxis: { min: number; max: number };
      series: { stackStrategy: string; data: unknown[] }[];
    };
    expect([option.yAxis.min, option.yAxis.max]).toEqual([0, 110]);
    expect(option.series.map((series) => series.stackStrategy)).toEqual(['all', 'all']);
    expect(option.series[0].data).toEqual([0, 95, 100, 0]);
  });

  it('starts a step that goes below zero at its real base', () => {
    const steps = waterfallSteps({
      assessment_id: 'a1',
      raw: 5,
      final: 0,
      waterfall: { judge: -12, clamp: 7 },
    });
    expect(waterfallRange(steps)).toEqual({ min: -10, max: 100 });
    const option = waterfallChart(steps) as { series: { data: unknown[] }[] };
    // Base (invisible) plus the visible part: 5 → −7 is drawn from −7 up to 5, and the clamp from −7 up to 0.
    expect(option.series[0].data).toEqual([0, -7, -7, 0]);
    const visible = option.series[1].data as { value: number }[];
    expect(visible.map((bar) => bar.value)).toEqual([5, 12, 7, 0]);
  });

  it('keeps the 0 to 100 axis when every step is inside it', () => {
    expect(
      waterfallRange(
        waterfallSteps({ assessment_id: 'a1', raw: 40, final: 50, waterfall: { A: 10 } }),
      ),
    ).toEqual({ min: 0, max: 100 });
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

  it('labels totals with their value and steps with their sign', () => {
    const steps = waterfallSteps({
      assessment_id: 'a1',
      raw: 50,
      final: 45,
      waterfall: { judge: -5 },
    });
    const option = waterfallChart(steps) as {
      tooltip: { formatter: (items: { dataIndex: number }[]) => string };
      series: { label?: { formatter: (item: { dataIndex: number }) => string } }[];
    };
    expect(option.tooltip.formatter([{ dataIndex: 0 }])).toBe('Crudo (100 × S): 50');
    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toBe('Ajuste del juez: −5');
    expect(option.tooltip.formatter([])).toBe('Crudo (100 × S): 50');
    const label = option.series[1].label?.formatter;
    expect(label?.({ dataIndex: 1 })).toBe('−5');
    expect(label?.({ dataIndex: 2 })).toBe('45');
  });
});
