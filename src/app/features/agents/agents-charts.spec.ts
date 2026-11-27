import { TELEMETRY_DAILY, TELEMETRY_SUMMARY } from './agents.fixtures';
import {
  agentPerformanceChart,
  dailyCostChart,
  hasCost,
  hasReviews,
  reasonsChart,
  runsTrendChart,
  runSuccessChart,
} from './agents-charts';

type Series = { name: string; data: unknown[] }[];
type Option = Record<string, unknown>;

const seriesOf = (option: Option) => option['series'] as Series;
const categoriesOf = (option: Option) => (option['xAxis'] as { data: string[] }).data;

describe('agents charts', () => {
  it('draws the runs per day, ended well and with an error, oldest first', () => {
    const option = runsTrendChart(TELEMETRY_DAILY.series) as Option;
    expect(categoriesOf(option)).toEqual(['26 nov', '27 nov']);
    expect(seriesOf(option).map((series) => [series.name, series.data])).toEqual([
      ['Terminadas bien', [4, 3]],
      ['Con error', [1, 0]],
    ]);
  });

  it('draws the success and latency of one agent, with a gap on days without reviews', () => {
    const judge = agentPerformanceChart(TELEMETRY_DAILY.series, 'judge') as Option;
    expect(seriesOf(judge).map((series) => series.data)).toEqual([
      [80, null],
      [2, null],
    ]);
    expect(seriesOf(judge)[0].name).toBe('Éxito · Juez');

    const news = agentPerformanceChart(TELEMETRY_DAILY.series, 'news_analyst') as Option;
    expect(seriesOf(news).map((series) => series.data)).toEqual([
      [100, null],
      [0.9, null],
    ]);

    const cve = agentPerformanceChart(TELEMETRY_DAILY.series, 'cve_analyst') as Option;
    expect(seriesOf(cve).map((series) => series.data)).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it('ignores a percentage text that is not a number', () => {
    const days = [
      {
        ...TELEMETRY_DAILY.series[0],
        agents: [{ ...TELEMETRY_DAILY.series[0].agents[0], success_percent: 'n/a' }],
      },
    ];
    const option = agentPerformanceChart(days, 'judge') as Option;
    expect(seriesOf(option)[0].data).toEqual([null]);
  });

  it('draws the success ring with the real counts of runs', () => {
    const option = runSuccessChart(8, 1, '88.9') as Option;
    const [ring] = seriesOf(option);
    expect(ring.data).toEqual([
      { name: 'Exitosas', value: 8 },
      { name: 'Con error', value: 1 },
    ]);
    expect((option['title'] as { text: string }[])[0].text).toBe('88.9 %');
    const legend = option['legend'] as { formatter: (name: string) => string };
    expect(legend.formatter('Exitosas')).toBe('Exitosas 8');
    expect(legend.formatter('Con error')).toBe('Con error 1');
  });

  it('draws the reasons of the judge with the times they were accepted and rejected', () => {
    const option = reasonsChart(TELEMETRY_SUMMARY.top_reasons) as Option;
    expect((option['yAxis'] as { data: string[] }).data).toEqual([
      'Explotación masiva',
      'Activo expuesto',
    ]);
    expect(seriesOf(option).map((series) => [series.name, series.data])).toEqual([
      ['Aceptado', [4, 2]],
      ['Rechazado', [1, 0]],
    ]);
  });

  it('draws the daily cost of each agent side by side, zero on days without its reviews', () => {
    const option = dailyCostChart(TELEMETRY_DAILY.series) as Option;
    expect(seriesOf(option).map((series) => [series.name, series.data])).toEqual([
      ['Juez', [0.04, 0]],
      ['Analista de noticias', [0.01, 0]],
      ['Analista de CVE', [0, 0]],
    ]);
    const tooltip = option['tooltip'] as { valueFormatter: (value: unknown) => string };
    expect(tooltip.valueFormatter(0.04)).toBe('USD 0.04');
  });
});

describe('empty charts', () => {
  it('tells a series with some cost from a zero-filled one', () => {
    expect(hasCost(TELEMETRY_DAILY.series)).toBe(true);
    const zero = TELEMETRY_DAILY.series.map((day) => ({
      ...day,
      agents: day.agents.map((entry) => ({ ...entry, cost_usd: '0.000' })),
    }));
    expect(hasCost(zero)).toBe(false);
    expect(hasCost([])).toBe(false);
  });

  it('tells an agent with reviews in the days from one without', () => {
    expect(hasReviews(TELEMETRY_DAILY.series, 'judge')).toBe(true);
    expect(hasReviews(TELEMETRY_DAILY.series, 'cve_analyst')).toBe(false);
    expect(hasReviews([], 'judge')).toBe(false);
  });
});
