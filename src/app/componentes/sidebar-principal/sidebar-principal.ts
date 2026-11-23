import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideBot, LucideDynamicIcon, LucideHouse, LucideLayers, LucideMonitor, LucideRss, LucideSlidersHorizontal } from '@lucide/angular';
import { MenuPerfil } from '../menu-perfil/menu-perfil';
import { filter } from 'rxjs';
import { ModoDashboard, OrigenDashboard } from '../../servicios/origen-dashboard';

@Component({
  selector: 'app-sidebar-principal',
  imports: [FormsModule, RouterLink, RouterLinkActive, LucideDynamicIcon, MenuPerfil],
  templateUrl: './sidebar-principal.html'
})
export class SidebarPrincipal {
  private readonly router = inject(Router);
  readonly origen = inject(OrigenDashboard);
  readonly seccionActiva = signal<string | null>(this.leerSeccionActual());

  constructor() {
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe(() => this.seccionActiva.set(this.leerSeccionActual()));
  }

  navegacion: { etiqueta: string; icono: any; ruta: string; activa: boolean; habilitada: boolean; seccion?: string }[] = [
    { etiqueta: 'Inicio', icono: LucideHouse, ruta: '/inicio', activa: false, habilitada: true },
    { etiqueta: 'Agentes', icono: LucideBot, ruta: '/agentes', activa: true, habilitada: true, seccion: 'agentes' },
    { etiqueta: 'Stack Tecnológico', icono: LucideLayers, ruta: '/stack-tecnologico', activa: true, habilitada: true },
    { etiqueta: 'Activos', icono: LucideMonitor, ruta: '/activos', activa: true, habilitada: true },
    { etiqueta: 'Feeds', icono: LucideRss, ruta: '/feeds', activa: true, habilitada: true },
    { etiqueta: 'Control de agentes', icono: LucideSlidersHorizontal, ruta: '/configuracion-agente', activa: true, habilitada: true }
  ];

  /** Cambia el origen de datos sin alterar la sesión Firebase autenticada. */
  cambiarOrigen(modo: ModoDashboard): void {
    this.origen.cambiarModo(modo);
  }

  private leerSeccionActual(): string | null {
    let ruta = this.router.routerState.snapshot.root;
    while (ruta.firstChild) ruta = ruta.firstChild;
    const seccion = ruta.data['sidebarSection'];
    return typeof seccion === 'string' ? seccion : null;
  }
}

