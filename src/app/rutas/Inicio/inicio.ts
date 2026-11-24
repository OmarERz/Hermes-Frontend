import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideActivity,
  LucideArrowRight,
  LucideBot,
  LucideFileClock,
  LucideLayers,
  LucideMonitor,
  LucideSlidersHorizontal,
} from '@lucide/angular';
import { CatalogoTecnologias } from '../../servicios/catalogo-tecnologias';
import { InventarioActivos } from '../../servicios/inventario-activos';
import { OrigenDashboard } from '../../servicios/origen-dashboard';
import { SupervisionAgentes } from '../../servicios/supervision-agentes';
import { SesionAutenticacion } from '../../servicios/sesion-autenticacion';

@Component({
  selector: 'app-inicio',
  imports: [
    RouterLink,
    LucideActivity,
    LucideArrowRight,
    LucideBot,
    LucideFileClock,
    LucideLayers,
    LucideMonitor,
    LucideSlidersHorizontal,
  ],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio implements OnInit {
  readonly origen = inject(OrigenDashboard);
  private readonly sesion = inject(SesionAutenticacion);
  private readonly catalogo = inject(CatalogoTecnologias);
  private readonly inventario = inject(InventarioActivos);
  private readonly supervision = inject(SupervisionAgentes);
  ngOnInit(): void {
    if (this.origen.modo() === 'real')
      this.inventario.cargar().subscribe({ error: () => undefined });
  }

  get demo(): boolean {
    return this.origen.modo() === 'demo';
  }
  /** Prefiere el nombre visible de Firebase y usa el email como alternativa legible. */
  get nombreSaludo(): string {
    const usuario = this.sesion.usuarioFirebase();
    const nombreVisible = usuario?.displayName?.trim();
    if (nombreVisible) return nombreVisible;
    return usuario?.email?.split('@', 1)[0].trim() || 'Usuario';
  }
  get totalTecnologias(): number | null {
    if (this.demo) return this.origen.tecnologias.length;
    const total = this.catalogo.tecnologias().length;
    return total > 0 ? total : null;
  }
  get totalActivos(): number | null {
    const total = this.demo ? this.origen.activos.length : this.inventario.activos.length;
    return total > 0 ? total : null;
  }
  get totalTickets(): number | null {
    return this.demo ? this.supervision.tickets.length : null;
  }
  get tasaExito(): number | null {
    return this.demo ? this.origen.agentes.tasaExito : null;
  }
}
