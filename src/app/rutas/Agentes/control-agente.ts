import { Component, inject } from '@angular/core';
import {
  LucideActivity,
  LucideBot,
  LucideChartColumn,
  LucideChartNoAxesCombined,
  LucideCircleCheck,
  LucideClock,
  LucideCpu,
  LucideLayers,
  LucideTriangleAlert,
  LucideZap,
} from '@lucide/angular';
import { GraficoDashboard } from '../../componentes/grafico-dashboard/grafico-dashboard';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import type { EChartsCoreOption } from 'echarts/core';
import { OrigenDashboard } from '../../servicios/origen-dashboard';
import { SupervisionAgentes, TicketDemo } from '../../servicios/supervision-agentes';
import { AyudaTooltip } from '../../componentes/ayuda-tooltip/ayuda-tooltip';
import { NavegacionAgentes } from '../../componentes/navegacion-agentes/navegacion-agentes';

@Component({
  selector: 'app-control-agente',
  imports: [
    GraficoDashboard,
    BannerPagina,
    NavegacionAgentes,
    AyudaTooltip,
    LucideActivity,
    LucideBot,
    LucideChartColumn,
    LucideChartNoAxesCombined,
    LucideCircleCheck,
    LucideClock,
    LucideCpu,
    LucideLayers,
    LucideTriangleAlert,
    LucideZap,
  ],
  templateUrl: './control-agente.html',
})
export class ControlAgente {
  readonly origen = inject(OrigenDashboard);
  private readonly supervision = inject(SupervisionAgentes);
  get demo() {
    return this.origen.modo() === 'demo';
  }
  get datosDemo() {
    return this.origen.agentes;
  }
  get ticketsDemo(): TicketDemo[] {
    return this.supervision.tickets;
  }
  get metricasTickets() {
    const tickets = this.ticketsDemo;
    const completados = tickets.filter((item) => item.estado === 'Completado');
    return {
      recibidos: new Set(tickets.map((item) => item.id)).size,
      completados: completados.length,
      pendientes: tickets.filter((item) => item.estado === 'Pendiente').length,
      ejecucion: tickets.filter((item) => item.estado === 'En ejecución').length,
      rechazados: tickets.filter((item) => item.estado === 'Rechazado').length,
      escalados: tickets.filter((item) => item.escalado).length,
      reasignados: tickets.filter((item) => item.reasignado).length,
      minutosResolucion: completados.length
        ? completados.reduce((total, item) => total + (item.minutosResolucion ?? 0), 0) /
          completados.length
        : null,
      porcentajeResueltos: tickets.length ? (completados.length / tickets.length) * 100 : 0,
    };
  }
  readonly iconoBanner = LucideBot;
  readonly successChart: EChartsCoreOption = {
    color: ['#ed079b', '#dfc4f5'],
    tooltip: { trigger: 'item', valueFormatter: (value: unknown) => `${value}%` },
    title: [
      {
        text: `${this.datosDemo.tasaExito} %`,
        left: '30%',
        top: '39%',
        textAlign: 'center',
        textStyle: { color: '#321044', fontSize: 27.67, fontWeight: 700 },
        subtext: 'Éxito',
        subtextStyle: { color: '#321044', fontSize: 14.67 },
      },
    ],
    legend: {
      orient: 'vertical',
      right: 2,
      top: 'middle',
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 13,
      textStyle: { color: '#321044', fontSize: 15.67 },
      formatter: (name: string) =>
        name === 'Exitosas'
          ? `Exitosas ${this.datosDemo.exitosas.toLocaleString('es-MX')}`
          : `Con error ${this.datosDemo.fallidas.toLocaleString('es-MX')}`,
    },
    series: [
      {
        type: 'pie',
        radius: ['59%', '80%'],
        center: ['30%', '52%'],
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 6 },
        label: { show: false },
        data: [
          { name: 'Exitosas', value: this.datosDemo.tasaExito },
          { name: 'Con error', value: 100 - this.datosDemo.tasaExito },
        ],
      },
    ],
  };

  readonly toolsChart: EChartsCoreOption = {
    color: ['#ed079b', '#9844df', '#c179e8', '#ddb4f0', '#e9d5f5'],
    title: [
      {
        text: `${this.datosDemo.tareasCompletadas.toLocaleString('es-MX')} usos`,
        right: 4,
        top: 0,
        textStyle: { color: '#321044', fontSize: 14.67, fontWeight: 600 },
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value: unknown) => `${value}%`,
    },
    grid: { left: 112, right: 40, top: 24, bottom: 6 },
    xAxis: {
      type: 'value',
      min: 0,
      max: 50,
      interval: 10,
      axisLabel: { color: '#51465e', fontSize: 14.67, formatter: '{value}%' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#eeeaf3' } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: this.datosDemo.herramientas.map((item) => item.nombre),
      axisLabel: { color: '#321044', fontSize: 14.67 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        showBackground: true,
        backgroundStyle: { color: '#f1e6f8', borderRadius: 8 },
        itemStyle: { borderRadius: [0, 7, 7, 0] },
        label: {
          show: true,
          position: 'right',
          color: '#321044',
          fontSize: 14.67,
          formatter: '{c}%',
        },
        data: this.datosDemo.herramientas.map((item) => item.porcentaje),
      },
    ],
  };

  readonly trendChart: EChartsCoreOption = {
    color: ['#ed079b'],
    tooltip: { trigger: 'axis' },
    grid: { left: 42, right: 12, top: 16, bottom: 32, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: this.datosDemo.dias,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#d9d5e3' } },
      axisLabel: { color: '#51465e', fontSize: 14.67 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1000,
      interval: 200,
      splitLine: { lineStyle: { color: '#e9e6ef' } },
      axisLabel: { color: '#51465e', fontSize: 14.67 },
    },
    series: [
      {
        name: 'Tareas completadas',
        type: 'line',
        smooth: 0.25,
        data: this.datosDemo.tareas,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: '#ed079b', width: 3 },
        itemStyle: { color: '#fff', borderColor: '#ed079b', borderWidth: 2 },
        areaStyle: { color: 'rgba(237,7,155,.15)' },
      },
    ],
  };

  readonly performanceChart: EChartsCoreOption = {
    color: ['#ed079b', '#9844df'],
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 11,
      itemHeight: 11,
      textStyle: { color: '#321044', fontSize: 14.67 },
    },
    grid: { left: 45, right: 45, top: 34, bottom: 34, containLabel: true },
    xAxis: {
      type: 'category',
      data: this.datosDemo.dias,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#d9d5e3' } },
      axisLabel: { color: '#51465e', fontSize: 14.67 },
    },
    yAxis: [
      {
        type: 'value',
        min: 90,
        max: 100,
        interval: 2,
        splitLine: { lineStyle: { color: '#e9e6ef' } },
        axisLine: { show: true, lineStyle: { color: '#ed079b' } },
        axisLabel: { formatter: '{value}%', color: '#51465e', fontSize: 14.67 },
      },
      {
        type: 'value',
        min: 0,
        max: 5,
        interval: 1,
        splitLine: { show: false },
        axisLine: { show: true, lineStyle: { color: '#9844df' } },
        axisLabel: { formatter: '{value}s', color: '#51465e', fontSize: 14.67 },
      },
    ],
    series: [
      {
        name: 'Tasa de éxito',
        type: 'line',
        smooth: 0.25,
        data: this.datosDemo.exitos,
        symbolSize: 6,
        lineStyle: { width: 2 },
      },
      {
        name: 'Tiempo de respuesta (s)',
        type: 'line',
        yAxisIndex: 1,
        smooth: 0.25,
        data: this.datosDemo.respuestas,
        symbolSize: 6,
        lineStyle: { width: 2 },
      },
    ],
  };
}
