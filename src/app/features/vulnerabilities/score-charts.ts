import type { EChartsCoreOption } from 'echarts/core';
import { formatDateTime } from '../../shared/labels';
import { signed, WATERFALL_LABELS, WATERFALL_ORDER } from './vulnerability-texts';
import type { Breakdown, ScoreHistoryPoint } from './vulnerabilities.service';

/** Prototype palette (Agents charts). */
const PINK = '#ed079b';
const VIOLET = '#9844df';
const GREEN = '#2bb673';
const AXIS = '#51465e';
const GRID = '#e9e6ef';

export interface WaterfallStep {
  key: string;
  label: string;
  value: number;
  /** Where the bar starts and ends on the 0–100 scale. */
  from: number;
  to: number;
  total: boolean;
}

/**
 * The Δ waterfall of EVA-12 as steps: raw (100 × S), every non-zero bar in a fixed order (unknown bars at the end),
 * and the final score. The bars are drawn as the backend gives them, never recalculated; the final step is the
 * backend's final.
 */
export function waterfallSteps(breakdown: Breakdown): WaterfallStep[] {
  const raw = breakdown.raw ?? 0;
  const keys = [
    ...WATERFALL_ORDER.filter((key) => key in breakdown.waterfall),
    ...Object.keys(breakdown.waterfall).filter((key) => !WATERFALL_ORDER.includes(key)),
  ];
  const steps: WaterfallStep[] = [
    { key: 'raw', label: 'Crudo (100 × S)', value: raw, from: 0, to: raw, total: true },
  ];
  let running = raw;
  for (const key of keys) {
    const value = breakdown.waterfall[key] ?? 0;
    if (value === 0) continue;
    steps.push({
      key,
      label: WATERFALL_LABELS[key] ?? key,
      value,
      from: running,
      to: running + value,
      total: false,
    });
    running += value;
  }
  steps.push({
    key: 'final',
    label: 'Final',
    value: breakdown.final,
    from: 0,
    to: breakdown.final,
    total: true,
  });
  return steps;
}

/**
 * Range of the value axis: at least 0 to 100, widened (to the next ten) when a running total goes past a limit
 * before the `clamp` bar brings it back, so every step is drawn whole.
 */
export function waterfallRange(steps: WaterfallStep[]): { min: number; max: number } {
  const ends = steps.flatMap((step) => [step.from, step.to]);
  return {
    min: Math.floor(Math.min(0, ...ends) / 10) * 10,
    max: Math.ceil(Math.max(100, ...ends) / 10) * 10,
  };
}

/**
 * Stacked-bar waterfall: an invisible base plus the visible part (violet totals, pink up, green down). Both series
 * stack every value whatever its sign (`stackStrategy: 'all'`), so a step that starts or ends below zero still
 * starts at its real base.
 */
export function waterfallChart(steps: WaterfallStep[]): EChartsCoreOption {
  const range = waterfallRange(steps);
  return {
    grid: { left: 12, right: 12, top: 18, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (items: { dataIndex: number }[]) => {
        const step = steps[items[0]?.dataIndex ?? 0];
        return step.total ? `${step.label}: ${step.value}` : `${step.label}: ${signed(step.value)}`;
      },
    },
    xAxis: {
      type: 'category',
      data: steps.map((step) => step.label),
      axisLabel: { color: AXIS, interval: 0, rotate: 20, fontSize: 12.67 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: range.min,
      max: range.max,
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { color: AXIS },
    },
    series: [
      {
        type: 'bar',
        stack: 'waterfall',
        stackStrategy: 'all',
        silent: true,
        itemStyle: { color: 'transparent' },
        data: steps.map((step) => Math.min(step.from, step.to)),
      },
      {
        type: 'bar',
        stack: 'waterfall',
        stackStrategy: 'all',
        barMaxWidth: 42,
        label: {
          show: true,
          position: 'top',
          formatter: (item: { dataIndex: number }) => {
            const step = steps[item.dataIndex];
            return step.total ? String(step.value) : signed(step.value);
          },
        },
        data: steps.map((step) => ({
          value: Math.abs(step.to - step.from),
          itemStyle: {
            color: step.total ? VIOLET : step.value > 0 ? PINK : GREEN,
            borderRadius: [5, 5, 0, 0],
          },
        })),
      },
    ],
  };
}

/** Final and base score of one finding over time (judge adjustment in the tooltip). */
export function historyChart(points: ScoreHistoryPoint[]): EChartsCoreOption {
  const dates = points.map((point) => formatDateTime(point.date));
  return {
    color: [PINK, VIOLET],
    grid: { left: 12, right: 16, top: 30, bottom: 8, containLabel: true },
    legend: { top: 0, textStyle: { color: AXIS } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: AXIS, fontSize: 12.67 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { color: AXIS },
    },
    series: [
      { name: 'Final', type: 'line', smooth: false, data: points.map((point) => point.final) },
      {
        name: 'Base',
        type: 'line',
        smooth: false,
        lineStyle: { type: 'dashed' },
        data: points.map((point) => point.base),
      },
    ],
  };
}
