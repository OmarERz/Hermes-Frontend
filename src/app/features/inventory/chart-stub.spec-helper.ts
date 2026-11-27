import { Component, input } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';

/**
 * Stand-in for `<app-grafico-dashboard>` in the specs of this folder: keeps the option and the label it receives
 * without loading ECharts (the chart component has its own tests).
 */
@Component({
  selector: 'app-grafico-dashboard',
  template: '',
  host: { '[attr.aria-label]': 'label()' },
})
export class ChartStub {
  readonly option = input.required<EChartsCoreOption>();
  readonly label = input('Gráfica');
}
