import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GraficoDashboard } from './grafico-dashboard';

/**
 * The chart loads ECharts lazily and only then watches its host size. These tests build the component in an injection
 * context, with no template, fixture or change detection, so nothing else can start the lazy load: each test runs it
 * exactly once and awaits it, with and without ResizeObserver support.
 */
function createChartComponent() {
  const component = TestBed.runInInjectionContext(() => new GraficoDashboard());
  component.option = { series: [] };
  const host = document.createElement('div');
  document.body.appendChild(host);
  component['chartHost'] = new ElementRef(host);
  return { component, host };
}

describe('GraficoDashboard', () => {
  // The first lazy load pays the cold import of the four ECharts modules, which can pass the default 5 s test timeout
  // on a busy machine (seen in the local gate); load them once here, with room, so each test only times its own work.
  beforeAll(async () => {
    await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ]);
  }, 60_000);

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('draws the chart without ResizeObserver support instead of throwing', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { component } = createChartComponent();

    await expect(component['createChart']()).resolves.toBeUndefined();

    expect(component['chart']).toBeDefined();
    expect(component['resizeObserver']).toBeUndefined();
    component.ngOnDestroy();
  });

  it('watches the host size when ResizeObserver exists and stops on destroy', async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        disconnect = disconnect;
      },
    );
    const { component, host } = createChartComponent();

    await component['createChart']();

    expect(observe).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith(host);
    component.ngOnDestroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
