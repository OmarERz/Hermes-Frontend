import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { GraficoDashboard } from '../../componentes/grafico-dashboard/grafico-dashboard';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { METRICS, TELEMETRY_DAILY } from './agents.fixtures';
import { AgentsService } from './agents.service';
import { ChartStub } from './chart-stub.spec-helper';
import { COST_DAYS, MetricsPage } from './metrics.page';

/** Rendering a whole screen in jsdom can pass the 5 s default on a loaded machine. */
const SCREEN = { timeout: 20_000 };

class FakeService {
  metrics = vi.fn<AgentsService['metrics']>(() => of(METRICS));
  daily = vi.fn<AgentsService['daily']>(() => of(TELEMETRY_DAILY));
}

async function render(service: FakeService) {
  TestBed.configureTestingModule({
    imports: [MetricsPage],
    providers: [
      { provide: AgentsService, useValue: service },
      ...provideFakeSession('reader'),
      provideRouter([]),
    ],
  });
  TestBed.overrideComponent(MetricsPage, {
    remove: { imports: [GraficoDashboard] },
    add: { imports: [ChartStub] },
  });
  const fixture = TestBed.createComponent(MetricsPage);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

const text = (node: Element | null | undefined) =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

function sections(element: HTMLElement): [string, string[]][] {
  return Array.from(element.querySelectorAll('.metric-group'))
    .filter((section) => section.querySelector('.metric-grid'))
    .map((section) => [
      text(section.querySelector('h2')),
      Array.from(section.querySelectorAll('.metric')).map(
        (card) =>
          `${text(card.querySelector('.metric-label'))}: ${text(card.querySelector('strong'))}`,
      ),
    ]);
}

const chart = (fixture: ComponentFixture<MetricsPage>) =>
  fixture.debugElement.query(By.css('app-grafico-dashboard'))?.componentInstance as
    ChartStub | undefined;

describe('MetricsPage', SCREEN, () => {
  it('shows each calculated metric with its unit in its section, unknown ones at the end', async () => {
    const { element } = await render(new FakeService());
    expect(sections(element)).toEqual([
      ['Calidad de las recomendaciones', ['Precisión: 82.5 %']],
      ['Juez', ['Nivel de la escalera del juez: 0 · Normal']],
      ['Uso de IA y costo', ['Costo de LLM del día: 0.42 USD', 'Reintentos de LLM: 3']],
      ['Operación e inventario', ['Cola de error: 2']],
      ['Notificaciones', ['Eventos en error: 0']],
      ['Otras métricas', ['Métrica nueva: 1.5 h']],
    ]);
    expect(element.querySelector('[data-metric="precision"] app-ayuda-tooltip')).not.toBeNull();
    expect(element.querySelector('[data-metric="brand_new_metric"] app-ayuda-tooltip')).toBeNull();
    expect(text(element.querySelector('.source-badge'))).toContain('Datos reales');
    expect(element.querySelector('.calculation-note')).toBeNull();
  });

  it('says the daily metrics are not calculated yet when only the ladder is there', async () => {
    const service = new FakeService();
    service.metrics.mockReturnValue(
      of({ ...METRICS, metrics: METRICS.metrics.filter((m) => m.key === 'judge_ladder_level') }),
    );
    const { element } = await render(service);
    expect(text(element.querySelector('.calculation-note'))).toContain(
      'todavía no se han calculado',
    );
    expect(sections(element).map(([title]) => title)).toEqual(['Juez']);
  });

  it('draws the daily cost of each agent for the last 30 days', async () => {
    const service = new FakeService();
    const { fixture } = await render(service);
    expect(service.daily).toHaveBeenCalledWith(COST_DAYS);
    const series = (chart(fixture)!.option() as { series: { name: string; data: number[] }[] })
      .series;
    expect(series.map((each) => [each.name, each.data])).toEqual([
      ['Juez', [0.04, 0]],
      ['Analista de noticias', [0.01, 0]],
      ['Analista de CVE', [0, 0]],
    ]);
  });

  it('shows the error of the board with a retry, without hiding the cost chart', async () => {
    const service = new FakeService();
    service.metrics.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Métricas no disponibles.')),
    );
    const { fixture, element } = await render(service);
    const alert = element.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('Métricas no disponibles.');
    expect(chart(fixture)).toBeDefined();
    service.metrics.mockReturnValue(of(METRICS));
    (alert.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(sections(element).length).toBe(6);
  });

  it('shows the error of the daily series with a retry', async () => {
    const service = new FakeService();
    service.daily.mockReturnValue(
      throwError(() => new ApiError(503, 'service_unavailable', 'Series no disponibles.')),
    );
    const { fixture, element } = await render(service);
    const alert = element.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('Series no disponibles.');
    service.daily.mockReturnValue(of({ days: 0, series: [] }));
    (alert.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(text(element.querySelector('.metric-group:last-of-type'))).toContain(
      'No hay datos diarios.',
    );
  });

  it('says it is loading while the board has not answered', async () => {
    const service = new FakeService();
    service.metrics.mockReturnValue(NEVER);
    service.daily.mockReturnValue(NEVER);
    const { element } = await render(service);
    expect(text(element)).toContain('Cargando las métricas…');
    expect(text(element)).toContain('Cargando el costo diario…');
    expect(element.querySelector('.source-badge')).toBeNull();
  });
});
