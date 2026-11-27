import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GraficoDashboard } from './grafico-dashboard';

/**
 * The chart loads ECharts lazily and only then watches its host size. These tests drive that second half directly
 * (no change detection, so the lazy load runs once and is awaited) with and without ResizeObserver support.
 */
function createChartComponent() {
  const fixture = TestBed.createComponent(GraficoDashboard);
  fixture.componentRef.setInput('option', { series: [] });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const component = fixture.componentInstance;
  component['chartHost'] = new ElementRef(host);
  return { fixture, component, host };
}

describe('GraficoDashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('draws the chart without ResizeObserver support instead of throwing', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { component, fixture } = createChartComponent();

    await expect(component['createChart']()).resolves.toBeUndefined();

    expect(component['chart']).toBeDefined();
    expect(component['resizeObserver']).toBeUndefined();
    fixture.destroy();
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
    const { component, fixture, host } = createChartComponent();

    await component['createChart']();

    expect(observe).toHaveBeenCalledWith(host);
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
