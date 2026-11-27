import type { EChartsCoreOption } from 'echarts/core';
import { LEVEL_LABELS, LEVELS, type Level } from '../../shared/labels';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  INSTALL_STATUSES,
  licenceValidity,
  type InstallStatus,
  type SoftwareCategory,
} from './inventory-labels';
import type { SoftwareItem } from './inventory.service';

/** One live licence of a product, with the installations that have it. */
export interface LicenceRow {
  key: string;
  product: string;
  name: string;
  usageLimit: string | null;
  validity: string;
  instances: number;
}

/**
 * Totals of the catalogue. Categories, statuses and licences count installations (FRONTEND.md §5: the API gives
 * them per product and the screen adds them up); levels and CPE count products.
 */
export interface CatalogueTotals {
  products: number;
  instances: number;
  byCategory: Record<SoftwareCategory, number>;
  /** Installations that iTop has not synced with a category yet (or of a custom class). */
  withoutCategory: number;
  byStatus: Record<InstallStatus, number>;
  byLevel: Record<Level | 'none', number>;
  withCpe: number;
  licensedInstances: number;
  licences: LicenceRow[];
}

export function catalogueTotals(items: readonly SoftwareItem[]): CatalogueTotals {
  const byCategory = Object.fromEntries(CATEGORIES.map((key) => [key, 0])) as Record<
    SoftwareCategory,
    number
  >;
  const byStatus = Object.fromEntries(INSTALL_STATUSES.map((key) => [key, 0])) as Record<
    InstallStatus,
    number
  >;
  const byLevel = Object.fromEntries([...LEVELS, 'none'].map((key) => [key, 0])) as Record<
    Level | 'none',
    number
  >;
  const licences: LicenceRow[] = [];
  let instances = 0;
  let categorized = 0;
  let withCpe = 0;
  let licensedInstances = 0;
  for (const item of items) {
    instances += item.instances;
    for (const key of CATEGORIES) {
      const count = item.by_category?.[key] ?? 0;
      byCategory[key] += count;
      categorized += count;
    }
    for (const key of INSTALL_STATUSES) byStatus[key] += item.by_status?.[key] ?? 0;
    byLevel[item.worst_level ?? 'none'] += 1;
    if (item.has_cpe) withCpe += 1;
    licensedInstances += item.licensed_instances;
    for (const licence of item.licences ?? []) {
      licences.push({
        key: `${item.id}-${licence.name}-${licences.length}`,
        product: item.name,
        name: licence.name,
        usageLimit: licence.usage_limit,
        validity: licenceValidity(licence),
        instances: licence.instances,
      });
    }
  }
  return {
    products: items.length,
    instances,
    byCategory,
    withoutCategory: Math.max(0, instances - categorized),
    byStatus,
    byLevel,
    withCpe,
    licensedInstances,
    licences,
  };
}

export type SoftwareChart = 'category' | 'level' | 'cpe';

export const CHART_TITLES: Record<SoftwareChart, string> = {
  category: 'Instalaciones por categoría',
  level: 'Software por peor nivel de vulnerabilidad',
  cpe: 'Software con y sin CPE',
};
export const CHARTS = Object.keys(CHART_TITLES) as SoftwareChart[];

/** Prototype palette. */
const PINK = '#ed079b';
const VIOLET = '#9844df';
const AXIS = '#51465e';
const GRID = '#e9e6ef';
const LEVEL_COLORS: Record<Level | 'none', string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
  none: '#a99bb8',
};

function barChart(labels: string[], values: number[], colors: string[]): EChartsCoreOption {
  return {
    animationDuration: 300,
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: AXIS, interval: 0, width: 90, overflow: 'break' },
      axisLine: { lineStyle: { color: GRID } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: AXIS },
      splitLine: { lineStyle: { color: GRID } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 46,
        data: values.map((value, index) => ({ value, itemStyle: { color: colors[index] } })),
        itemStyle: { borderRadius: [6, 6, 0, 0] },
      },
    ],
  };
}

/** The option of the selected chart, drawn from the totals as they are (nothing estimated). */
export function softwareChart(kind: SoftwareChart, totals: CatalogueTotals): EChartsCoreOption {
  if (kind === 'level') {
    const keys = [...LEVELS, 'none'] as const;
    return barChart(
      keys.map((key) => (key === 'none' ? 'Sin vulnerabilidades' : LEVEL_LABELS[key])),
      keys.map((key) => totals.byLevel[key]),
      keys.map((key) => LEVEL_COLORS[key]),
    );
  }
  if (kind === 'cpe') {
    return {
      animationDuration: 300,
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: AXIS } },
      series: [
        {
          type: 'pie',
          radius: ['42%', '70%'],
          label: { formatter: '{b}: {c}' },
          data: [
            { name: 'Con CPE', value: totals.withCpe, itemStyle: { color: VIOLET } },
            {
              name: 'Sin CPE',
              value: totals.products - totals.withCpe,
              itemStyle: { color: PINK },
            },
          ],
        },
      ],
    };
  }
  const labels = CATEGORIES.map((key) => CATEGORY_LABELS[key]);
  const values = CATEGORIES.map((key) => totals.byCategory[key]);
  if (totals.withoutCategory > 0) {
    labels.push('Sin categoría');
    values.push(totals.withoutCategory);
  }
  return barChart(
    labels,
    values,
    labels.map((_label, index) => (index % 2 === 0 ? PINK : VIOLET)),
  );
}

/** Whether the selected chart has anything to draw. */
export function chartHasData(kind: SoftwareChart, totals: CatalogueTotals): boolean {
  return kind === 'category' ? totals.instances > 0 : totals.products > 0;
}
