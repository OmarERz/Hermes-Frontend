import { Component, inject } from '@angular/core';
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
import { SessionService } from '../../core/auth/session.service';

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
export class Inicio {
  private readonly sesion = inject(SessionService);
  private readonly catalogo = inject(CatalogoTecnologias);
  private readonly inventario = inject(InventarioActivos);
  /** Prefiere el nombre visible de Firebase y usa el email como alternativa legible. */
  get nombreSaludo(): string {
    const perfil = this.sesion.profile();
    const usuario = this.sesion.user();
    const nombreVisible = perfil?.display_name?.trim() || usuario?.displayName?.trim();
    if (nombreVisible) return nombreVisible;
    const correo = perfil?.email ?? usuario?.email;
    return correo?.split('@', 1)[0].trim() || 'Usuario';
  }
  get totalTecnologias(): number | null {
    const total = this.catalogo.tecnologias().length;
    return total > 0 ? total : null;
  }
  get totalActivos(): number | null {
    const total = this.inventario.activos.length;
    return total > 0 ? total : null;
  }
  /** No backend route yet: the start screen shows "Sin datos". */
  readonly totalTickets: number | null = null;
  readonly tasaExito: number | null = null;
}
