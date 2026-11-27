import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { GraficoDashboard } from '../../componentes/grafico-dashboard/grafico-dashboard';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import {
  AGENT_JUDGE,
  HISTORY_RUN,
  METRICS,
  TELEMETRY_DAILY,
  TELEMETRY_SUMMARY,
  TICKET_SUMMARY,
} from './agents.fixtures';
import { agentCard, AgentsDashboardPage, chartDays, orderAgents } from './agents-dashboard.page';
import { AgentsService } from './agents.service';
import { ChartStub } from './chart-stub.spec-helper';

class FakeService {
  summary = vi.fn<AgentsService['summary']>(() => of(TELEMETRY_SUMMARY));
  daily = vi.fn<AgentsService['daily']>(() => of(TELEMETRY_DAILY));
  ticketSummary = vi.fn<AgentsService['ticketSummary']>(() => of(TICKET_SUMMARY));
  latestRun = vi.fn<AgentsService['latestRun']>(() => of(HISTORY_RUN));
  metrics = vi.fn<AgentsService['metrics']>(() => of(METRICS));
  reviews = vi.fn<AgentsService['reviews']>(() => of({ items: [], nextCursor: null }));
}

const failure = (message = 'Telemetría no disponible.') =>
  throwError(() => new ApiError(503, 'service_unavailable', message));

async function render(service: FakeService) {
  TestBed.configureTestingModule({
    imports: [AgentsDashboardPage],
    providers: [
      { provide: AgentsService, useValue: service },
      ...provideFakeSession('reader'),
      provideRouter([]),
    ],
  });
  TestBed.overrideComponent(AgentsDashboardPage, {
    remove: { imports: [GraficoDashboard] },
    add: { imports: [ChartStub] },
  });
  const fixture = TestBed.createComponent(AgentsDashboardPage);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

const text = (node: Element | null | undefined) =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Text of each child element, joined by a space (the prototype markup has no spaces between them). */
const parts = (node: Element) => Array.from(node.children).map(text).filter(Boolean).join(' ');

function metricValues(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('.metric > div')).map(parts);
}

function charts(fixture: ComponentFixture<AgentsDashboardPage>): ChartStub[] {
  return fixture.debugElement
    .queryAll(By.css('app-grafico-dashboard'))
    .map((debug) => debug.componentInstance as ChartStub);
}

describe('AgentsDashboardPage', () => {
  it('shows the run and judge indicators of the window, with the error queue of the metrics', async () => {
    const { element } = await render(new FakeService());
    expect(metricValues(element)).toEqual([
      '88.9 %',
      '8',
      '2.4 s p95 5.1 s',
      'Normal Nivel 0',
      '1 Cola de error: 2',
    ]);
    expect(element.querySelector('.metric em.warn')?.textContent).toContain('Cola de error');
    expect(text(element.querySelector('.source-badge'))).toContain('Datos reales · calculado');
  });

  it('draws the four charts from the daily series and the summary', async () => {
    const { fixture } = await render(new FakeService());
    const [trend, performance, success, reasons] = charts(fixture);
    expect((trend.option() as { series: { data: number[] }[] }).series[0].data).toEqual([4, 3]);
    expect(performance.label()).toContain('Juez');
    expect((success.option() as { series: { data: unknown[] }[] }).series[0].data).toEqual([
      { name: 'Exitosas', value: 8 },
      { name: 'Con error', value: 1 },
    ]);
    expect(reasons.label()).toContain('Motivos del juez');
  });

  it('draws the performance of the agent picked in its chart', async () => {
    const { fixture, element } = await render(new FakeService());
    const select = element.querySelector('.chart-select') as HTMLSelectElement;
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.chartAgent()).toBe('news_analyst');
    expect(charts(fixture)[1].label()).toContain('Analista de noticias');
  });

  it('reloads the summary and the series when the window changes', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    expect(service.summary).toHaveBeenLastCalledWith('24h');
    expect(service.daily).toHaveBeenLastCalledWith(7);

    const select = element.querySelector('.performance-heading select') as HTMLSelectElement;
    select.value = select.options[2].value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(service.summary).toHaveBeenLastCalledWith('30d');
    expect(service.daily).toHaveBeenLastCalledWith(30);
    expect(element.querySelector('.trend-chart h3')?.textContent).toContain('últimos 30 días');

    fixture.componentInstance.setWindow('7d');
    expect(service.summary).toHaveBeenLastCalledWith('7d');
    expect(service.daily).toHaveBeenLastCalledWith(7);
  });

  it('shows one card per real agent, judge first, with its provider, model, latency and cost', async () => {
    const { element } = await render(new FakeService());
    const blocks = Array.from(element.querySelectorAll('.agent-block'));
    expect(blocks.map((block) => text(block.querySelector('h3')))).toEqual([
      'Juez Activo',
      'Analista de noticias Activo',
      'Analista de CVE Detenido',
    ]);
    const judgeFacts = Array.from(blocks[0].querySelectorAll('.agent-facts > div')).map(parts);
    expect(judgeFacts[0]).toBe('Modelo / Motor Claude (Claude Code) · opus');
    expect(judgeFacts[1]).toBe('Revisiones 12 Válidas: 91.7 %');
    expect(judgeFacts[2]).toBe('Respuesta promedio 2.4 s p95: 5.1 s');
    expect(judgeFacts[3]).toMatch(/^Costo en la ventana USD 0\.0842 Hoy: USD 0\.021/);
    expect(text(blocks[0].querySelector('.agent-tokens'))).toBe(
      'Tokens: 48,210 de entrada · 6,120 de salida',
    );
    const cveFacts = Array.from(blocks[2].querySelectorAll('.agent-facts > div')).map(parts);
    expect(cveFacts[1]).toBe('Revisiones 0 Válidas: Sin datos');
    expect(cveFacts[2]).toBe('Respuesta promedio Sin datos p95: Sin datos');
    expect(blocks[2].querySelector('.pill')?.classList).toContain('paused');
    expect(text(element.querySelector('.budget'))).toMatch(/USD 0\.025 de USD 5\.00/);
  });

  it('shows the ticket summary with the real states of Hermes', async () => {
    const { element } = await render(new FakeService());
    const kpis = Array.from(element.querySelectorAll('.ticket-kpis > div')).map((kpi) => [
      text(kpi.querySelector('small')),
      text(kpi.querySelector('strong')),
    ]);
    expect(kpis).toEqual([
      ['Total', '14'],
      ['Por crear en iTop', '2'],
      ['Abiertos', '7'],
      ['Resueltos', '3'],
      ['Cerrados', '2'],
      ['Cambiados por una persona', '2'],
      ['Urgencia crítica', '3'],
      ['Resolución promedio', '30.5 h'],
      ['Porcentaje resuelto', '41.7 %'],
    ]);
    expect(element.querySelector('.ticket-link')?.getAttribute('href')).toBe('/tickets');
  });

  it('shows the processes with the runs completed today and the last run', async () => {
    const { element } = await render(new FakeService());
    expect(Array.from(element.querySelectorAll('.queue-stats b')).map(text)).toEqual([
      '1',
      '3',
      '1',
    ]);
    expect(text(element.querySelector('.last-run'))).toContain(
      'Última corrida: Escaneo simulado · Terminó bien',
    );
  });

  it('shows a run in progress as the last run', async () => {
    const service = new FakeService();
    service.latestRun.mockReturnValue(
      of({ ...HISTORY_RUN, status: 'running', duration_seconds: null }),
    );
    const { element } = await render(service);
    expect(text(element.querySelector('.last-run'))).toContain(
      'Última corrida: Escaneo simulado · En ejecución',
    );
  });

  it('says when there are no runs yet and when the last run cannot be read', async () => {
    let service = new FakeService();
    service.latestRun.mockReturnValue(of(null));
    let view = await render(service);
    expect(text(view.element.querySelector('.last-run'))).toBe(
      'Última corrida: Aún no hay corridas.',
    );
    TestBed.resetTestingModule();

    service = new FakeService();
    service.latestRun.mockReturnValue(failure());
    view = await render(service);
    expect(text(view.element.querySelector('.last-run'))).toBe('Última corrida: No disponible');
  });

  it('shows empty states instead of empty charts when nothing ran and the judge used no reasons', async () => {
    const service = new FakeService();
    service.summary.mockReturnValue(
      of({
        ...TELEMETRY_SUMMARY,
        runs_succeeded: 0,
        runs_failed: 0,
        run_success_percent: null,
        top_reasons: [],
        agents: [],
      }),
    );
    service.metrics.mockReturnValue(of({ generated_at: 'x', metrics: [] }));
    const { element } = await render(service);
    expect(text(element.querySelector('.success-chart'))).toContain(
      'No hay corridas terminadas en esta ventana.',
    );
    expect(text(element.querySelector('.usage-chart'))).toContain(
      'El juez no propuso motivos en esta ventana.',
    );
    expect(text(element.querySelector('.agent-status'))).toContain(
      'El backend no reportó agentes.',
    );
    expect(metricValues(element)[0]).toBe('Sin datos');
    expect(metricValues(element)[2]).toBe('Sin datos p95 Sin datos');
    expect(metricValues(element)[4]).toBe('0 Cola de error: sin calcular');
  });

  it('marks a judge on a higher ladder level', async () => {
    const service = new FakeService();
    service.summary.mockReturnValue(
      of({ ...TELEMETRY_SUMMARY, ladder_level: 2, ladder_label: 'Cauteloso' }),
    );
    const { element } = await render(service);
    expect(text(element.querySelector('.agent-status .panel-title .pill'))).toBe('Juez: Cauteloso');
    expect(element.querySelector('.agent-status .panel-title .pill')?.classList).toContain(
      'paused',
    );
  });

  it('shows the error of the summary with a retry, without hiding the tickets', async () => {
    const service = new FakeService();
    service.summary.mockReturnValue(failure());
    const { fixture, element } = await render(service);
    const alerts = element.querySelectorAll(
      '.performance [role="alert"], .agent-status [role="alert"]',
    );
    expect(alerts.length).toBe(2);
    expect(alerts[0].textContent).toContain('Telemetría no disponible.');
    expect(element.querySelectorAll('.ticket-kpis > div').length).toBe(9);

    service.summary.mockReturnValue(of(TELEMETRY_SUMMARY));
    (alerts[0].querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.summary).toHaveBeenCalledTimes(2);
    expect(metricValues(element)[0]).toBe('88.9 %');
  });

  it('shows the error of the daily series in its charts and retries it', async () => {
    const service = new FakeService();
    service.daily.mockReturnValue(failure('Series no disponibles.'));
    const { fixture, element } = await render(service);
    expect(text(element.querySelector('.trend-chart [role="alert"]'))).toContain(
      'Series no disponibles.',
    );
    expect(text(element.querySelector('.queue-stats'))).toContain('Sin datos');
    service.daily.mockReturnValue(of(TELEMETRY_DAILY));
    (element.querySelector('.agent-chart [role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.daily).toHaveBeenCalledTimes(2);
    expect(charts(fixture).length).toBe(4);
  });

  it('shows the error of the tickets with a retry', async () => {
    const service = new FakeService();
    service.ticketSummary.mockReturnValue(failure('Tickets no disponibles.'));
    const { fixture, element } = await render(service);
    const alert = element.querySelector('.ticket-overview [role="alert"]')!;
    expect(alert.textContent).toContain('Tickets no disponibles.');
    service.ticketSummary.mockReturnValue(of(TICKET_SUMMARY));
    (alert.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(element.querySelectorAll('.ticket-kpis > div').length).toBe(9);
  });

  it('says the error queue is unavailable when the metrics fail, and retries them', async () => {
    const service = new FakeService();
    service.metrics.mockReturnValue(failure());
    const { fixture, element } = await render(service);
    const retry = element.querySelector('.metric .queue-retry') as HTMLButtonElement;
    expect(retry.getAttribute('aria-label')).toBe(
      'La cola de error no está disponible. Reintentar',
    );
    service.metrics.mockReturnValue(of(METRICS));
    retry.click();
    await fixture.whenStable();
    expect(service.metrics).toHaveBeenCalledTimes(2);
    expect(metricValues(element)[4]).toBe('1 Cola de error: 2');
  });

  it('marks the error queue as loading until the metrics answer', async () => {
    const service = new FakeService();
    service.metrics.mockReturnValue(NEVER);
    const { element } = await render(service);
    expect(metricValues(element)[4]).toBe('1 Cola de error: …');
  });
});

describe('agents dashboard helpers', () => {
  it('uses a week of daily points, or the month for the 30 day window', () => {
    expect(chartDays('24h')).toBe(7);
    expect(chartDays('7d')).toBe(7);
    expect(chartDays('30d')).toBe(30);
  });

  it('orders the agents judge first and keeps an unknown agent at the end', () => {
    const unknown = { ...AGENT_JUDGE, agent: 'triage' as never };
    expect(orderAgents([unknown, ...TELEMETRY_SUMMARY.agents]).map((entry) => entry.agent)).toEqual(
      ['judge', 'news_analyst', 'cve_analyst', 'triage'],
    );
    const card = agentCard({ ...unknown, model: '' });
    expect(card.name).toBe('triage');
    expect(card.description).toBe('');
    expect(card.engine).toBe('Claude (Claude Code) · Sin datos');
  });
});
