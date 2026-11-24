import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideActivity, LucideClock, LucideListFilter } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { EjecucionDemo, SupervisionAgentes } from '../../servicios/supervision-agentes';
import { NavegacionAgentes } from '../../componentes/navegacion-agentes/navegacion-agentes';

@Component({
  selector: 'app-historial-agente',
  imports: [FormsModule, BannerPagina, NavegacionAgentes, LucideClock, LucideListFilter],
  templateUrl: './historial-agente.html',
})
export class HistorialAgente {
  private readonly supervision = inject(SupervisionAgentes);
  readonly iconoBanner = LucideActivity;
  desde = '';
  hasta = '';
  agente = '';
  ticket = '';
  estado = '';
  tipo = '';
  seleccionada: EjecucionDemo | null = null;
  get registros(): EjecucionDemo[] {
    return this.supervision.ejecuciones;
  }
  get agentes(): string[] {
    return [...new Set(this.registros.map((item) => item.agente))];
  }
  get tickets(): string[] {
    return [...new Set(this.registros.map((item) => item.ticketId))];
  }
  get estados(): string[] {
    return [...new Set(this.registros.map((item) => item.estadoFinal))];
  }
  get tipos(): string[] {
    return [...new Set(this.registros.map((item) => item.tipo))];
  }
  get filtrados(): EjecucionDemo[] {
    return this.registros.filter(
      (item) =>
        (!this.desde || item.fecha.slice(0, 10) >= this.desde) &&
        (!this.hasta || item.fecha.slice(0, 10) <= this.hasta) &&
        (!this.agente || item.agente === this.agente) &&
        (!this.ticket || item.ticketId === this.ticket) &&
        (!this.estado || item.estadoFinal === this.estado) &&
        (!this.tipo || item.tipo === this.tipo),
    );
  }
}
