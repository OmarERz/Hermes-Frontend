import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LucideGitCompareArrows, LucideScale } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import {
  proyectarPuntajesRevision,
  RevisionDemo,
  SupervisionAgentes,
} from '../../servicios/supervision-agentes';
import { NavegacionAgentes } from '../../componentes/navegacion-agentes/navegacion-agentes';
import { RevisionHumana } from '../Revision-humana/revision-humana';

@Component({
  selector: 'app-recomendaciones-agente',
  imports: [BannerPagina, NavegacionAgentes, LucideGitCompareArrows, LucideScale, RevisionHumana],
  templateUrl: './recomendaciones-agente.html',
})
export class RecomendacionesAgente implements OnInit {
  private readonly supervision = inject(SupervisionAgentes);
  private readonly route = inject(ActivatedRoute);
  readonly iconoBanner = LucideGitCompareArrows;
  ticketSeleccionado = '';
  recomendacionSeleccionada = '';
  filtroEstado = '';
  revisionAbierta = false;
  mensajeRevision = '';

  get recomendaciones() {
    return this.supervision.revisiones();
  }
  get ticketsEnConflicto() {
    return new Set(
      this.recomendaciones
        .filter((item) => item.decisionJuez === 'En desacuerdo')
        .map((item) => item.ticketId),
    );
  }
  get ticketsUnicos() {
    return [...new Set(this.recomendaciones.map((item) => item.ticketId))];
  }
  get estadosRevision(): string[] {
    return [...new Set(this.recomendaciones.map((item) => item.estadoRevision))];
  }
  get ticketsFiltrados(): string[] {
    return this.ticketsUnicos.filter(
      (ticketId) =>
        !this.filtroEstado ||
        this.porTicket(ticketId).some((item) => item.estadoRevision === this.filtroEstado),
    );
  }
  porTicket(ticketId: string) {
    return this.recomendaciones.filter((item) => item.ticketId === ticketId);
  }
  agentesPorTicket(ticketId: string): string {
    return [...new Set(this.porTicket(ticketId).map((item) => item.agente))].join(' · ');
  }
  estadoPorTicket(ticketId: string): string {
    const estados = [...new Set(this.porTicket(ticketId).map((item) => item.estadoRevision))];
    return estados.length === 1 ? estados[0] : 'Estados distintos';
  }
  get ticketActivo(): string {
    return this.ticketsFiltrados.includes(this.ticketSeleccionado)
      ? this.ticketSeleccionado
      : (this.ticketsFiltrados[0] ?? '');
  }
  get propuestasActivas(): RevisionDemo[] {
    return this.ticketActivo ? this.porTicket(this.ticketActivo) : [];
  }
  get revisionActivaId(): string {
    return this.propuestasActivas.some((item) => item.id === this.recomendacionSeleccionada)
      ? this.recomendacionSeleccionada
      : (this.propuestasActivas[0]?.id ?? '');
  }
  puntajes(propuesta: RevisionDemo) {
    return proyectarPuntajesRevision(propuesta);
  }
  opinionesJuezExplicitas(propuesta: RevisionDemo) {
    return propuesta.evaluacion?.opinionesJuez ?? [];
  }
  mostrarPuntaje(valor: number | null | undefined): number | string {
    return valor === null || valor === undefined ? 'No disponible' : valor;
  }

  ngOnInit(): void {
    const ticketSolicitado = this.route.snapshot.queryParamMap.get('ticketId') ?? '';
    const recomendacionSolicitada =
      this.route.snapshot.queryParamMap.get('recomendacionId') ??
      this.route.snapshot.queryParamMap.get('id') ??
      '';
    const porId = this.recomendaciones.find((item) => item.id === recomendacionSolicitada);
    const ticketExiste = this.ticketsUnicos.includes(ticketSolicitado);
    if (porId) {
      this.ticketSeleccionado = porId.ticketId;
      this.recomendacionSeleccionada = porId.id;
      this.revisionAbierta = true;
    } else if (ticketExiste) {
      this.ticketSeleccionado = ticketSolicitado;
      this.recomendacionSeleccionada = this.porTicket(ticketSolicitado)[0]?.id ?? '';
      this.revisionAbierta = true;
    }
  }

  seleccionarTicket(ticketId: string): void {
    this.ticketSeleccionado = ticketId;
    this.recomendacionSeleccionada = this.porTicket(ticketId)[0]?.id ?? '';
  }

  abrirRevisionHumana(): void {
    this.mensajeRevision = '';
    this.revisionAbierta = true;
  }

  cerrarRevisionHumana(): void {
    this.revisionAbierta = false;
  }

  registrarDecision(mensaje: string): void {
    this.mensajeRevision = mensaje;
    this.revisionAbierta = false;
  }
}
