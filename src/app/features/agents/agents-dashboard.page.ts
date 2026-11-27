import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideActivity,
  LucideBot,
  LucideChartColumn,
  LucideChartNoAxesCombined,
  LucideCircleCheck,
  LucideClock,
  LucideCpu,
  LucideLayers,
  LucideScale,
  LucideTriangleAlert,
  LucideZap,
} from '@lucide/angular';
import { AyudaTooltip } from '../../componentes/ayuda-tooltip/ayuda-tooltip';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { GraficoDashboard } from '../../componentes/grafico-dashboard/grafico-dashboard';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { formatDateTime } from '../../shared/labels';
import {
  Agent,
  AGENT_DESCRIPTIONS,
  AGENT_LABELS,
  AGENTS,
  labelOf,
  PROVIDER_LABELS,
  RUN_KIND_LABELS,
  RUN_STATUS_LABELS,
  TelemetryWindow,
  WINDOW_LABELS,
  WINDOWS,
} from './agent-labels';
import {
  agentPerformanceChart,
  reasonsChart,
  runsTrendChart,
  runSuccessChart,
} from './agents-charts';
import {
  AgentsService,
  AgentTelemetry,
  MetricsDashboard,
  Run,
  TelemetryDaily,
  TelemetrySummary,
  TicketSummary,
} from './agents.service';
import {
  formatCount,
  formatHours,
  formatLatency,
  formatPercent,
  formatUsd,
  NO_DATA,
} from './formatting';
import { ReviewsLog } from './reviews-log';

/** Days of the daily charts: a week, or the month when the window is 30 days. */
export function chartDays(window: TelemetryWindow): number {
  return window === '30d' ? 30 : 7;
}

/** What a panel shows instead of its content while it loads or after it failed (null: the content). */
function panelState(state: AsyncState<unknown>): ViewState | null {
  const status = state.status();
  if (status === 'ready') return null;
  return status === 'error' ? 'error' : 'loading';
}

export interface AgentCard {
  agent: Agent;
  name: string;
  description: string;
  active: boolean;
  engine: string;
  reviews: string;
  successNote: string;
  latency: string;
  latencyNote: string;
  cost: string;
  costNote: string;
  tokens: string;
}

/** One card per real AI agent (AG-10, AG-12): provider and model in effect, never a key. */
export function agentCard(entry: AgentTelemetry): AgentCard {
  return {
    agent: entry.agent,
    name: labelOf(AGENT_LABELS, entry.agent),
    description: (AGENT_DESCRIPTIONS as Record<string, string>)[entry.agent] ?? '',
    active: entry.active,
    engine: `${labelOf(PROVIDER_LABELS, entry.provider)} · ${entry.model || NO_DATA}`,
    reviews: formatCount(entry.reviews),
    successNote: `Válidas: ${formatPercent(entry.success_percent)}`,
    latency: formatLatency(entry.latency_avg_ms),
    latencyNote: `p95: ${formatLatency(entry.latency_p95_ms)}`,
    cost: formatUsd(entry.cost_usd),
    costNote: `Hoy: ${formatUsd(entry.spend_today_usd)}`,
    tokens: `${formatCount(entry.tokens_input)} de entrada · ${formatCount(entry.tokens_output)} de salida`,
  };
}

/** The agents in screen order (judge, news analyst, CVE analyst), any new one at the end. */
export function orderAgents(agents: readonly AgentTelemetry[]): AgentTelemetry[] {
  const rank = (agent: string) => {
    const index = AGENTS.indexOf(agent as Agent);
    return index === -1 ? AGENTS.length : index;
  };
  return [...agents].sort((a, b) => rank(a.agent) - rank(b.agent));
}

/**
 * Panel de agentes: the prototype's agent control screen (same design and charts) on the F18.1 telemetry. Runs and
 * the three real AI agents (news analyst, CVE analyst and judge) over a window of 24 hours, 7 or 30 days
 * (`GET /api/telemetry/summary` and `/daily`), the ticket summary (`GET /api/tickets/summary`), the last run and the
 * LLM review log. The invented data of the prototype (tool usage, uptime, «GPT-4o», ticket states that do not exist)
 * is gone or reconverted to its real equivalent (D-088).
 */
@Component({
  selector: 'app-agents-dashboard-page',
  imports: [
    FormsModule,
    RouterLink,
    AsyncStateComponent,
    AyudaTooltip,
    BannerPagina,
    GraficoDashboard,
    ReviewsLog,
    LucideActivity,
    LucideBot,
    LucideChartColumn,
    LucideChartNoAxesCombined,
    LucideCircleCheck,
    LucideClock,
    LucideCpu,
    LucideLayers,
    LucideScale,
    LucideTriangleAlert,
    LucideZap,
  ],
  templateUrl: './agents-dashboard.page.html',
  styleUrl: './agents-dashboard.page.css',
})
export class AgentsDashboardPage {
  private readonly service = inject(AgentsService);

  readonly bannerIcon = LucideBot;
  readonly windows = WINDOWS;
  readonly windowLabels = WINDOW_LABELS;
  readonly agentOptions = AGENTS;
  readonly agentLabels = AGENT_LABELS;
  readonly formatDateTime = formatDateTime;
  readonly formatCount = formatCount;

  readonly window = signal<TelemetryWindow>('24h');
  readonly chartAgent = signal<Agent>('judge');

  readonly summary = new AsyncState<TelemetrySummary>();
  readonly daily = new AsyncState<TelemetryDaily>();
  readonly tickets = new AsyncState<TicketSummary>();
  readonly latestRun = new AsyncState<Run | null>();
  readonly metrics = new AsyncState<MetricsDashboard>();

  readonly summaryState = computed(() => panelState(this.summary));
  readonly dailyState = computed(() => panelState(this.daily));
  readonly ticketState = computed(() => panelState(this.tickets));

  readonly days = computed(() => chartDays(this.window()));

  /** The summary once loaded for the current window (null while it loads or after a failure). */
  readonly current = computed(() =>
    this.summary.status() === 'ready' ? this.summary.value() : null,
  );
  readonly series = computed(() =>
    this.daily.status() === 'ready' ? (this.daily.value()?.series ?? []) : [],
  );

  readonly agents = computed(() => orderAgents(this.current()?.agents ?? []).map(agentCard));
  readonly judge = computed(
    () => this.current()?.agents.find((entry) => entry.agent === 'judge') ?? null,
  );

  readonly runSuccess = computed(() => formatPercent(this.current()?.run_success_percent));
  readonly judgeLatency = computed(() => formatLatency(this.judge()?.latency_avg_ms));
  readonly judgeLatencyP95 = computed(() => formatLatency(this.judge()?.latency_p95_ms));
  readonly ladderPaused = computed(() => (this.current()?.ladder_level ?? 0) > 0);
  readonly budget = computed(() => {
    const summary = this.current();
    return summary
      ? `${formatUsd(summary.spend_today_usd)} de ${formatUsd(summary.daily_budget_usd)}`
      : NO_DATA;
  });

  /** Size of the error queue (MET-18) from the metrics board, when it has been calculated. */
  readonly errorQueue = computed(() => {
    if (this.metrics.status() !== 'ready') return null;
    return (
      this.metrics.value()?.metrics.find((metric) => metric.key === 'error_queue_size') ?? null
    );
  });

  /** Runs that ended well today: the last point of the daily series is today (UTC). */
  readonly completedToday = computed(() => {
    const series = this.series();
    return series.length ? formatCount(series[series.length - 1].runs_succeeded) : NO_DATA;
  });

  readonly trendChart = computed(() =>
    this.series().length ? runsTrendChart(this.series()) : null,
  );
  readonly performanceChart = computed(() =>
    this.series().length ? agentPerformanceChart(this.series(), this.chartAgent()) : null,
  );
  readonly successChart = computed(() => {
    const summary = this.current();
    if (!summary || summary.runs_succeeded + summary.runs_failed === 0) return null;
    return runSuccessChart(
      summary.runs_succeeded,
      summary.runs_failed,
      summary.run_success_percent ?? '0',
    );
  });
  readonly reasonChart = computed(() => {
    const reasons = this.current()?.top_reasons ?? [];
    return reasons.length ? reasonsChart(reasons) : null;
  });

  readonly lastRun = computed(() => {
    if (this.latestRun.status() !== 'ready') return null;
    const run = this.latestRun.value();
    if (!run) return 'Aún no hay corridas.';
    return `${labelOf(RUN_KIND_LABELS, run.kind)} · ${labelOf(RUN_STATUS_LABELS, run.status)} · ${formatDateTime(run.started_at)}`;
  });

  readonly ticketKpis = computed(() => {
    const summary = this.tickets.status() === 'ready' ? this.tickets.value() : null;
    if (!summary) return [];
    const byStatus = (status: string) => formatCount(summary.by_status[status] ?? 0);
    return [
      {
        label: 'Total',
        value: formatCount(summary.total),
        help: 'Todos los tickets, también los que esperan crearse en iTop.',
      },
      {
        label: 'Por crear en iTop',
        value: byStatus('pending_creation'),
        help: 'Tickets que Hermes todavía no ha creado en iTop.',
      },
      { label: 'Abiertos', value: byStatus('open'), help: null },
      { label: 'Resueltos', value: byStatus('resolved'), help: null },
      { label: 'Cerrados', value: byStatus('closed'), help: null },
      {
        label: 'Cambiados por una persona',
        value: formatCount(summary.changed_by_person),
        help: 'Tickets cuya urgencia cambió una persona en iTop; Hermes ya solo sugiere en ellos.',
      },
      {
        label: 'Urgencia crítica',
        value: formatCount(summary.by_urgency['1'] ?? 0),
        help: 'Tickets ya creados en iTop con urgencia 1.',
      },
      {
        label: 'Resolución promedio',
        value: formatHours(summary.avg_resolution_hours),
        help: 'Horas promedio desde la creación en iTop hasta la resolución.',
      },
      {
        label: 'Porcentaje resuelto',
        value: formatPercent(summary.resolved_percent),
        help: 'Resueltos o cerrados sobre los tickets que ya están en iTop.',
      },
    ];
  });

  constructor() {
    this.loadTelemetry();
    this.loadTickets();
    this.loadLatestRun();
    this.metrics.run(this.service.metrics());
    inject(DestroyRef).onDestroy(() => {
      for (const state of [this.summary, this.daily, this.tickets, this.latestRun, this.metrics]) {
        state.cancel();
      }
    });
  }

  setWindow(window: TelemetryWindow): void {
    this.window.set(window);
    this.loadTelemetry();
  }

  loadSummary(): void {
    this.summary.run(this.service.summary(this.window()));
  }

  loadDaily(): void {
    this.daily.run(this.service.daily(this.days()));
  }

  loadTickets(): void {
    this.tickets.run(this.service.ticketSummary());
  }

  loadLatestRun(): void {
    this.latestRun.run(this.service.latestRun());
  }

  private loadTelemetry(): void {
    this.loadSummary();
    this.loadDaily();
  }
}
