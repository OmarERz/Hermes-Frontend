import type { EChartsCoreOption } from 'echarts/core';
import { AGENT_LABELS, AGENTS, type Agent } from './agent-labels';
import type { ReasonUsage, TelemetryDay } from './agents.service';
import { formatDay } from './formatting';

/** Prototype palette of the Agents charts (the chart component swaps them for the dark theme). */
const PINK = '#ed079b';
const VIOLET = '#9844df';
const LILAC = '#dfc4f5';
const INK = '#321044';
const AXIS = '#51465e';
const GRID = '#e9e6ef';
const AXIS_LINE = '#d9d5e3';
const FONT = 14.67;

const categoryAxis = (days: readonly TelemetryDay[], boundaryGap = true) => ({
  type: 'category',
  boundaryGap,
  data: days.map((day) => formatDay(day.date)),
  axisTick: { show: false },
  axisLine: { lineStyle: { color: AXIS_LINE } },
  axisLabel: { color: AXIS, fontSize: FONT },
});

/** A decimal text of the API as a number for the chart only (never added up); null leaves a gap. */
function chartNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** «Corridas por día» (AG-6): runs that ended well and with an error per UTC day, oldest first. */
export function runsTrendChart(days: readonly TelemetryDay[]): EChartsCoreOption {
  return {
    color: [PINK, VIOLET],
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 11,
      itemHeight: 11,
      textStyle: { color: INK, fontSize: FONT },
    },
    grid: { left: 12, right: 12, top: 34, bottom: 8, containLabel: true },
    xAxis: categoryAxis(days, false),
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { color: AXIS, fontSize: FONT },
    },
    series: [
      {
        name: 'Terminadas bien',
        type: 'line',
        smooth: 0.25,
        data: days.map((day) => day.runs_succeeded),
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: PINK, width: 3 },
        itemStyle: { color: '#fff', borderColor: PINK, borderWidth: 2 },
        areaStyle: { color: 'rgba(237,7,155,.15)' },
      },
      {
        name: 'Con error',
        type: 'line',
        smooth: 0.25,
        data: days.map((day) => day.runs_failed),
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: VIOLET, width: 2 },
        itemStyle: { color: VIOLET },
      },
    ],
  };
}

/**
 * «Desempeño del agente» (AG-7): % of valid reviews (left axis) and average latency in seconds (right axis) of one
 * agent per UTC day. Days without reviews leave a gap instead of a zero.
 */
export function agentPerformanceChart(
  days: readonly TelemetryDay[],
  agent: Agent,
): EChartsCoreOption {
  const points = days.map((day) => day.agents.find((entry) => entry.agent === agent) ?? null);
  return {
    color: [PINK, VIOLET],
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 11,
      itemHeight: 11,
      textStyle: { color: INK, fontSize: FONT },
    },
    grid: { left: 12, right: 12, top: 34, bottom: 8, containLabel: true },
    xAxis: categoryAxis(days),
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: 100,
        interval: 25,
        splitLine: { lineStyle: { color: GRID } },
        axisLine: { show: true, lineStyle: { color: PINK } },
        axisLabel: { formatter: '{value}%', color: AXIS, fontSize: FONT },
      },
      {
        type: 'value',
        min: 0,
        splitLine: { show: false },
        axisLine: { show: true, lineStyle: { color: VIOLET } },
        axisLabel: { formatter: '{value}s', color: AXIS, fontSize: FONT },
      },
    ],
    series: [
      {
        name: `Éxito · ${AGENT_LABELS[agent]}`,
        type: 'line',
        smooth: 0.25,
        connectNulls: false,
        data: points.map((point) => chartNumber(point?.success_percent)),
        symbolSize: 6,
        lineStyle: { width: 2 },
      },
      {
        name: 'Respuesta promedio (s)',
        type: 'line',
        yAxisIndex: 1,
        smooth: 0.25,
        connectNulls: false,
        data: points.map((point) =>
          point?.latency_avg_ms === null || point?.latency_avg_ms === undefined
            ? null
            : Math.round(point.latency_avg_ms / 100) / 10,
        ),
        symbolSize: 6,
        lineStyle: { width: 2 },
      },
    ],
  };
}

/** «Tasa de éxito de ejecución» (AG-1): the prototype's ring with the real counts of runs that ended. */
export function runSuccessChart(
  succeeded: number,
  failed: number,
  percent: string,
): EChartsCoreOption {
  const count = new Intl.NumberFormat('es-MX');
  return {
    color: [PINK, LILAC],
    tooltip: { trigger: 'item' },
    title: [
      {
        text: `${percent} %`,
        left: '30%',
        top: '39%',
        textAlign: 'center',
        textStyle: { color: INK, fontSize: 27.67, fontWeight: 700 },
        subtext: 'Éxito',
        subtextStyle: { color: INK, fontSize: FONT },
      },
    ],
    legend: {
      orient: 'vertical',
      right: 2,
      top: 'middle',
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 13,
      textStyle: { color: INK, fontSize: 15.67 },
      formatter: (name: string) =>
        name === 'Exitosas'
          ? `Exitosas ${count.format(succeeded)}`
          : `Con error ${count.format(failed)}`,
    },
    series: [
      {
        type: 'pie',
        radius: ['59%', '80%'],
        center: ['30%', '52%'],
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 6 },
        label: { show: false },
        data: [
          { name: 'Exitosas', value: succeeded },
          { name: 'Con error', value: failed },
        ],
      },
    ],
  };
}

/**
 * «Motivos del juez más usados» (AG-8 reconverted from the invented tool usage): accepted and rejected times of each
 * reason in the window, as the prototype's horizontal bars.
 */
export function reasonsChart(reasons: readonly ReasonUsage[]): EChartsCoreOption {
  return {
    color: [PINK, LILAC],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 11,
      itemHeight: 11,
      textStyle: { color: INK, fontSize: FONT },
    },
    grid: { left: 8, right: 30, top: 30, bottom: 6, containLabel: true },
    xAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      axisLabel: { color: AXIS, fontSize: FONT },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#eeeaf3' } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: reasons.map((reason) => reason.label),
      axisLabel: { color: INK, fontSize: FONT, width: 150, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Aceptado',
        type: 'bar',
        stack: 'reason',
        barWidth: 14,
        itemStyle: { borderRadius: [0, 0, 0, 0] },
        data: reasons.map((reason) => reason.accepted),
      },
      {
        name: 'Rechazado',
        type: 'bar',
        stack: 'reason',
        barWidth: 14,
        itemStyle: { borderRadius: [0, 7, 7, 0] },
        data: reasons.map((reason) => reason.rejected),
      },
    ],
  };
}

/**
 * «Costo de IA por día» (MET-17): the cost of each agent per UTC day, side by side, never added up. A day without
 * an agent's reviews costs zero (the daily series is zero-filled).
 */
export function dailyCostChart(days: readonly TelemetryDay[]): EChartsCoreOption {
  return {
    color: [PINK, VIOLET, '#c179e8'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value: unknown) => `USD ${String(value)}`,
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 11,
      itemHeight: 11,
      textStyle: { color: INK, fontSize: FONT },
    },
    grid: { left: 12, right: 12, top: 34, bottom: 8, containLabel: true },
    xAxis: categoryAxis(days),
    yAxis: {
      type: 'value',
      min: 0,
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { color: AXIS, fontSize: FONT, formatter: 'USD {value}' },
    },
    series: AGENTS.map((agent) => ({
      name: AGENT_LABELS[agent],
      type: 'bar',
      barMaxWidth: 12,
      data: days.map(
        (day) => chartNumber(day.agents.find((entry) => entry.agent === agent)?.cost_usd) ?? 0,
      ),
    })),
  };
}
