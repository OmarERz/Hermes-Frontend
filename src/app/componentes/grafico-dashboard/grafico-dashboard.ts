import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';

@Component({
  selector: 'app-grafico-dashboard',
  templateUrl: './grafico-dashboard.html',
  styleUrl: './grafico-dashboard.css',
})
export class GraficoDashboard implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) option!: EChartsCoreOption;
  @Input() label = 'Gráfica';
  @ViewChild('chartHost') private chartHost?: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private chart?: EChartsType;
  private resizeObserver?: ResizeObserver;
  private themeObserver?: MutationObserver;
  private destroyed = false;

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) void this.createChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['option'] && this.chart) {
      this.actualizarGrafica();
      requestAnimationFrame(() => this.chart?.resize());
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.themeObserver?.disconnect();
    this.chart?.dispose();
  }

  private async createChart() {
    const [core, charts, components, renderers] = await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ]);
    if (this.destroyed || !this.chartHost) return;

    core.use([
      charts.BarChart,
      charts.GaugeChart,
      charts.LineChart,
      charts.PieChart,
      charts.ScatterChart,
      components.GridComponent,
      components.LegendComponent,
      components.TitleComponent,
      components.TooltipComponent,
      renderers.SVGRenderer,
    ]);
    this.chart = core.init(this.chartHost.nativeElement, undefined, { renderer: 'svg' });
    this.actualizarGrafica();
    // Environments without ResizeObserver (jsdom in unit tests, very old browsers) keep a fixed-size chart instead of
    // throwing after the lazy ECharts import resolves.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
      this.resizeObserver.observe(this.chartHost.nativeElement);
    }
    const themeRoot = this.chartHost.nativeElement.closest('[data-theme]');
    if (themeRoot) {
      this.themeObserver = new MutationObserver(() => this.actualizarGrafica());
      this.themeObserver.observe(themeRoot, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }

  private actualizarGrafica() {
    if (!this.chart || !this.chartHost) return;
    const isDark =
      this.chartHost.nativeElement.closest('[data-theme]')?.getAttribute('data-theme') === 'dark';
    const darkPalette: Record<string, string> = {
      '#321044': '#f8efff',
      '#51465e': '#c7b6d8',
      '#e9e6ef': 'rgba(217,168,255,.16)',
      '#d9d5e3': 'rgba(217,168,255,.28)',
      '#e8e5ef': 'rgba(217,168,255,.18)',
      '#d4cfdf': 'rgba(217,168,255,.32)',
      '#fff': '#29133f',
    };
    const lightTextPalette: Record<string, string> = { '#51465e': '#302936' };
    const themedOption = this.transformarPaleta(
      this.option,
      isDark ? darkPalette : lightTextPalette,
    ) as Record<string, unknown>;
    const textColor = isDark ? '#f8efff' : '#302936';
    const tooltipDefaults = {
      backgroundColor: isDark ? '#321849' : '#ffffff',
      borderColor: isDark ? 'rgba(217,168,255,.3)' : '#ddd4e5',
      textStyle: { color: textColor, fontSize: 13.67 },
    };
    const tooltip = {
      ...tooltipDefaults,
      ...((themedOption['tooltip'] as object) ?? {}),
      textStyle: {
        ...tooltipDefaults.textStyle,
        ...((themedOption['tooltip'] as { textStyle?: object } | undefined)?.textStyle ?? {}),
      },
    };
    const withReadableLabels = this.aplicarColorTexto(themedOption, textColor);
    this.chart.setOption(
      {
        ...withReadableLabels,
        textStyle: {
          color: textColor,
          ...((withReadableLabels['textStyle'] as object | undefined) ?? {}),
        },
        tooltip,
      } as EChartsCoreOption,
      { notMerge: true },
    );
  }

  private aplicarColorTexto(
    value: Record<string, unknown>,
    color: string,
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (Array.isArray(item))
        output[key] = item.map((entry) =>
          entry && typeof entry === 'object'
            ? this.aplicarColorTexto(entry as Record<string, unknown>, color)
            : entry,
        );
      else if (item && typeof item === 'object') {
        const nested = this.aplicarColorTexto(item as Record<string, unknown>, color);
        if (['axisLabel', 'textStyle', 'label', 'subtextStyle'].includes(key)) {
          if (nested['color'] === undefined) nested['color'] = color;
          if (typeof nested['fontSize'] === 'number' && nested['fontSize'] < 11)
            nested['fontSize'] = 11;
        }
        output[key] = nested;
      } else output[key] = item;
    }
    return output;
  }

  private transformarPaleta(value: unknown, palette: Record<string, string>): unknown {
    if (typeof value === 'string') return palette[value.toLowerCase()] ?? value;
    if (Array.isArray(value)) return value.map((item) => this.transformarPaleta(item, palette));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.transformarPaleta(item, palette)]),
      );
    }
    return value;
  }
}
