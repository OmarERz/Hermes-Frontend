import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideActivity,
  LucideArrowLeft,
  LucideArrowRight,
  LucideChartColumn,
  LucideDownload,
  LucideLayers,
  LucideTriangleAlert,
} from '@lucide/angular';
import type { EChartsCoreOption } from 'echarts/core';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { GraficoDashboard } from '../../componentes/grafico-dashboard/grafico-dashboard';
import {
  CatalogoTecnologias,
  CategoriaTecnologia,
  EstadoTecnologia,
  LicenciaTecnologia,
  TecnologiaEmpresa,
} from '../../servicios/catalogo-tecnologias';
import {
  CATEGORIAS_DASHBOARD,
  ESTADOS_DASHBOARD,
  LICENCIAS_DASHBOARD,
  OrigenDashboard,
} from '../../servicios/origen-dashboard';
import type { PrioridadVulnerabilidad } from '../../servicios/resultados-vulnerabilidades-agente';
import { ResultadosVulnerabilidadesAgente } from '../../servicios/resultados-vulnerabilidades-agente';

@Component({
  selector: 'app-stack-tecnologico',
  imports: [
    FormsModule,
    BannerPagina,
    GraficoDashboard,
    LucideActivity,
    LucideArrowLeft,
    LucideArrowRight,
    LucideChartColumn,
    LucideDownload,
    LucideLayers,
    LucideTriangleAlert,
  ],
  templateUrl: './stack-tecnologico.html',
})
export class StackTecnologico {
  private readonly catalogo = inject(CatalogoTecnologias);
  readonly origen = inject(OrigenDashboard);
  private readonly resultadosVulnerabilidades = inject(ResultadosVulnerabilidadesAgente);
  readonly iconoBanner = LucideLayers;
  readonly categorias: CategoriaTecnologia[] = CATEGORIAS_DASHBOARD;
  readonly estados: EstadoTecnologia[] = ESTADOS_DASHBOARD;
  readonly licencias: LicenciaTecnologia[] = LICENCIAS_DASHBOARD;
  readonly tecnologiasReales = this.catalogo.tecnologias;
  get tecnologias() {
    return this.origen.modo() === 'demo' ? this.origen.tecnologias : this.tecnologiasReales();
  }
  readonly total = computed(() => this.tecnologias.length);
  readonly openSource = computed(
    () => this.tecnologias.filter((item) => item.licencia === 'Open source').length,
  );
  readonly enEvaluacion = computed(
    () => this.tecnologias.filter((item) => item.estado === 'En evaluación').length,
  );
  categoria = 'Todas';
  pagina = 1;
  readonly porPagina = 8;
  graficaSeleccionada:
    'categoria' | 'salud' | 'madurez' | 'calidad' | 'negocio' | 'vulnerabilidades' = 'categoria';
  readonly prioridadesVulnerabilidad: readonly {
    valor: PrioridadVulnerabilidad;
    etiqueta: string;
    color: string;
  }[] = [
    { valor: 'critical', etiqueta: 'Críticas', color: '#dc2626' },
    { valor: 'high', etiqueta: 'Altas', color: '#ea580c' },
    { valor: 'medium', etiqueta: 'Medias', color: '#ca8a04' },
    { valor: 'low', etiqueta: 'Bajas', color: '#16a34a' },
  ];
  private readonly conteosDemoVulnerabilidades: Readonly<Record<PrioridadVulnerabilidad, number>> =
    {
      critical: 3,
      high: 6,
      medium: 9,
      low: 4,
    };
  animarCambioGrafica = false;
  readonly opcionesGraficas = [
    { valor: 'categoria', titulo: 'Tecnologías por categoría' },
    { valor: 'salud', titulo: 'Salud del stack' },
    { valor: 'madurez', titulo: 'Madurez tecnológica' },
    { valor: 'calidad', titulo: 'Calidad por categoría' },
    { valor: 'negocio', titulo: 'Valor de negocio' },
    { valor: 'vulnerabilidades', titulo: 'Vulnerabilidades por prioridad' },
  ] as const;

  get tituloGraficaSeleccionada(): string {
    return (
      this.opcionesGraficas.find((opcion) => opcion.valor === this.graficaSeleccionada)?.titulo ??
      this.opcionesGraficas[0].titulo
    );
  }

  get vulnerabilidadesClasificadas() {
    return this.origen.modo() === 'real'
      ? (this.resultadosVulnerabilidades.resultado()?.vulnerabilities ?? [])
      : [];
  }

  get conteosVulnerabilidades() {
    const esDemo = this.origen.modo() === 'demo';
    const vulnerabilidadesReales = esDemo ? [] : this.vulnerabilidadesClasificadas;
    return this.prioridadesVulnerabilidad.map((prioridad) => ({
      ...prioridad,
      cantidad: esDemo
        ? this.conteosDemoVulnerabilidades[prioridad.valor]
        : vulnerabilidadesReales.filter(
            (vulnerabilidad) => vulnerabilidad.priority === prioridad.valor,
          ).length,
    }));
  }

  get graficaDisponible(): boolean {
    if (this.graficaSeleccionada === 'categoria') return this.total() > 0;
    if (this.graficaSeleccionada === 'vulnerabilidades')
      return this.origen.modo() === 'demo' || this.vulnerabilidadesClasificadas.length > 0;
    return this.origen.modo() === 'demo';
  }

  get etiquetaGraficaSeleccionada(): string {
    const etiquetas: Record<typeof this.graficaSeleccionada, string> = {
      categoria: 'Cantidad de tecnologías registradas por categoría',
      salud: 'Salud demostrativa del stack: 86 por ciento',
      madurez: 'Madurez demostrativa por tecnología, escala de uno a cinco',
      calidad: 'Calidad demostrativa por categoría',
      negocio: 'Valor de negocio demostrativo por dimensión',
      vulnerabilidades: 'Vulnerabilidades únicas por prioridad clasificadas por el agente',
    };
    return etiquetas[this.graficaSeleccionada];
  }

  get opcionGraficaSeleccionada(): EChartsCoreOption {
    switch (this.graficaSeleccionada) {
      case 'salud':
        return this.demoHealthChart;
      case 'madurez':
        return this.demoMaturityChart;
      case 'calidad':
        return this.demoQualityChart;
      case 'negocio':
        return this.demoBusinessChart;
      case 'vulnerabilidades':
        return this.vulnerabilityPriorityChart;
      default:
        return this.categoryChart;
    }
  }

  cambiarGrafica(valor: typeof this.graficaSeleccionada): void {
    if (valor === this.graficaSeleccionada) return;
    this.animarCambioGrafica = false;
    this.graficaSeleccionada = valor;
    requestAnimationFrame(() => (this.animarCambioGrafica = true));
  }

  get tecnologiasFiltradas(): TecnologiaEmpresa[] {
    return this.categoria === 'Todas'
      ? this.tecnologias
      : this.tecnologias.filter((item) => item.categoria === this.categoria);
  }

  get tecnologiasVisibles(): TecnologiaEmpresa[] {
    const inicio = (this.pagina - 1) * this.porPagina;
    return this.tecnologiasFiltradas.slice(inicio, inicio + this.porPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.tecnologiasFiltradas.length / this.porPagina));
  }

  get categoryChart(): EChartsCoreOption {
    const cantidades = this.categorias.map(
      (categoria) => this.tecnologias.filter((item) => item.categoria === categoria).length,
    );
    const maximo = Math.max(1, ...cantidades);
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 34, right: 12, top: 18, bottom: 42, containLabel: true },
      xAxis: {
        type: 'category',
        data: this.categorias,
        axisTick: { show: false },
        axisLabel: { interval: 0, rotate: 18, fontSize: 12.67 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: maximo,
        minInterval: 1,
        splitLine: { lineStyle: { color: '#e9e6ef' } },
      },
      series: [
        {
          type: 'bar',
          name: 'Tecnologías',
          data: cantidades,
          barMaxWidth: 38,
          itemStyle: { borderRadius: [6, 6, 0, 0], color: '#d40794' },
          label: { show: true, position: 'top' },
        },
      ],
    };
  }

  get demoHealthChart(): EChartsCoreOption {
    return {
      series: [
        {
          type: 'gauge',
          min: 0,
          max: 100,
          progress: { show: true, width: 12, itemStyle: { color: '#ed079b' } },
          axisLine: { lineStyle: { width: 12, color: [[1, '#eadcf2']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          detail: {
            valueAnimation: false,
            formatter: '{value}%',
            color: '#321044',
            fontSize: 29.67,
            fontWeight: 700,
            offsetCenter: [0, '10%'],
          },
          data: [{ value: this.origen.stack.salud }],
        },
      ],
    };
  }

  get demoQualityChart(): EChartsCoreOption {
    return this.demoBars(
      this.origen.stack.calidad.map((item) => item.nombre),
      this.origen.stack.calidad.map((item) => item.valor),
      '%',
      100,
    );
  }
  get demoMaturityChart(): EChartsCoreOption {
    return this.demoBars(
      this.origen.stack.madurez.map((item) => item.nombre),
      this.origen.stack.madurez.map((item) => item.valor),
      '/5',
      5,
    );
  }
  get demoBusinessChart(): EChartsCoreOption {
    return this.demoBars(
      this.origen.stack.valorNegocio.map((item) => item.nombre),
      this.origen.stack.valorNegocio.map((item) => item.valor),
      ' pts',
      100,
    );
  }
  get vulnerabilityPriorityChart(): EChartsCoreOption {
    const conteos = this.conteosVulnerabilidades;
    const maximo = Math.max(1, ...conteos.map((item) => item.cantidad));
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: unknown) => `${value} vulnerabilidades`,
      },
      grid: { left: 24, right: 16, top: 20, bottom: 42, containLabel: true },
      xAxis: {
        type: 'category',
        data: conteos.map((item) => item.etiqueta),
        axisTick: { show: false },
        axisLabel: { interval: 0, rotate: 0, fontSize: 14.67 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: maximo,
        minInterval: 1,
        splitLine: { lineStyle: { color: '#e9e6ef' } },
      },
      series: [
        {
          type: 'bar',
          name: 'Vulnerabilidades únicas',
          data: conteos.map((item) => ({ value: item.cantidad, itemStyle: { color: item.color } })),
          barMaxWidth: 54,
          itemStyle: { borderRadius: [6, 6, 0, 0] },
          label: { show: true, position: 'top', fontSize: 14.67 },
        },
      ],
    };
  }
  private demoBars(
    categorias: string[],
    valores: number[],
    unidad: string,
    maximo: number,
  ): EChartsCoreOption {
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: unknown) => `${value}${unidad}`,
      },
      grid: { left: 12, right: 12, top: 12, bottom: 38, containLabel: true },
      xAxis: {
        type: 'category',
        data: categorias,
        axisLabel: { interval: 0, rotate: 15, fontSize: 12.67 },
        axisTick: { show: false },
      },
      yAxis: { type: 'value', min: 0, max: maximo, splitLine: { lineStyle: { color: '#e9e6ef' } } },
      series: [
        {
          type: 'bar',
          data: valores,
          barMaxWidth: 34,
          itemStyle: { color: '#d40794', borderRadius: [5, 5, 0, 0] },
          label: { show: true, position: 'top', formatter: `{c}${unidad}`, fontSize: 12.67 },
        },
      ],
    };
  }

  cantidadCategoria(categoria: CategoriaTecnologia): number {
    return this.tecnologias.filter((item) => item.categoria === categoria).length;
  }

  cantidadEstado(estado: EstadoTecnologia): number {
    return this.tecnologias.filter((item) => item.estado === estado).length;
  }

  cantidadLicencia(licencia: LicenciaTecnologia): number {
    return this.tecnologias.filter((item) => item.licencia === licencia).length;
  }

  anterior(): void {
    this.pagina = Math.max(1, this.pagina - 1);
  }
  siguiente(): void {
    this.pagina = Math.min(this.totalPaginas, this.pagina + 1);
  }

  exportar(): void {
    const encabezados = ['Nombre', 'Categoría', 'Versión', 'Descripción', 'Estado', 'Licencia'];
    const filas = this.tecnologias.map((item) => [
      item.nombre,
      item.categoria,
      item.version,
      item.descripcion,
      item.estado,
      item.licencia,
    ]);
    const csv = [encabezados, ...filas]
      .map((fila) => fila.map((valor) => `"${valor.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(
      new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }),
    );
    enlace.download = 'hermes-control-stack.csv';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }
}
