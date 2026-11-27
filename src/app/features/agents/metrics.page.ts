import { Component, computed, DestroyRef, inject } from '@angular/core';
import { LucideChartColumn, LucideCoins, LucideDynamicIcon } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { GraficoDashboard } from '../../componentes/grafico-dashboard/grafico-dashboard';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { KpiCard } from '../../shared/kpi-card';
import { formatDateTime } from '../../shared/labels';
import { dailyCostChart, hasCost } from './agents-charts';
import { AgentsService, MetricsDashboard, TelemetryDaily } from './agents.service';
import { groupMetrics } from './metric-groups';
import { loadState } from './view-state';

/** Days of the cost chart. */
export const COST_DAYS = 30;

/**
 * Métricas (FRO-21): the board of docs/10 from `GET /api/metrics`, the latest value of each metric as the backend
 * calculated and formatted it, by section and in the prototype's agent card design, plus the daily AI cost per agent
 * of the last 30 days (`GET /api/telemetry/daily`, MET-17). A metric the backend has not calculated yet is not shown
 * (never a zero), and one this screen does not know goes to «Otras métricas».
 */
@Component({
  selector: 'app-metrics-page',
  imports: [
    AsyncStateComponent,
    BannerPagina,
    GraficoDashboard,
    KpiCard,
    LucideCoins,
    LucideDynamicIcon,
  ],
  templateUrl: './metrics.page.html',
  styleUrl: './metrics.page.css',
})
export class MetricsPage {
  private readonly service = inject(AgentsService);

  readonly bannerIcon = LucideChartColumn;
  readonly costDays = COST_DAYS;
  readonly formatDateTime = formatDateTime;

  readonly board = new AsyncState<MetricsDashboard>();
  readonly daily = new AsyncState<TelemetryDaily>();

  readonly boardState = computed(() => loadState(this.board));
  readonly dailyState = computed(() => loadState(this.daily));

  readonly current = computed(() => (this.board.status() === 'ready' ? this.board.value() : null));
  readonly groups = computed(() => groupMetrics(this.current()?.metrics ?? []));
  /** Only the judge ladder (always present): the daily metrics have not been calculated yet. */
  readonly nothingCalculated = computed(() => {
    const metrics = this.current()?.metrics ?? [];
    return metrics.every((metric) => metric.key === 'judge_ladder_level');
  });

  private readonly costSeries = computed(() =>
    this.daily.status() === 'ready' ? (this.daily.value()?.series ?? []) : [],
  );
  /** Null when no agent cost anything: a zero-filled chart would draw only its axes (G11, MET-3). */
  readonly costChart = computed(() =>
    hasCost(this.costSeries()) ? dailyCostChart(this.costSeries()) : null,
  );
  readonly costEmptyText = computed(() =>
    this.costSeries().length
      ? `La IA no tuvo costo en los últimos ${COST_DAYS} días.`
      : 'No hay datos diarios.',
  );

  constructor() {
    this.loadBoard();
    this.loadDaily();
    inject(DestroyRef).onDestroy(() => {
      this.board.cancel();
      this.daily.cancel();
    });
  }

  loadBoard(): void {
    this.board.run(this.service.metrics());
  }

  loadDaily(): void {
    this.daily.run(this.service.daily(COST_DAYS));
  }
}
