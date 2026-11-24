import {
  Component,
  ElementRef,
  HostListener,
  inject,
  Input,
  signal,
  ViewChild,
} from '@angular/core';
import { LucideChevronDown, LucideLogOut } from '@lucide/angular';
import { Router } from '@angular/router';
import { ROLE_LABELS } from '../../core/auth/roles';
import { SessionService } from '../../core/auth/session.service';

@Component({
  selector: 'app-menu-perfil',
  imports: [LucideChevronDown, LucideLogOut],
  templateUrl: './menu-perfil.html',
  styleUrl: './menu-perfil.css',
})
export class MenuPerfil {
  private readonly elemento = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  readonly sesion = inject(SessionService);
  @Input() ubicacion: 'arriba' | 'abajo' = 'abajo';
  @Input() menuId = 'profile-dropdown';

  readonly cerrandoSesion = signal(false);
  readonly errorCierre = signal('');
  menuAbierto = false;

  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;

  /** Name from GET /api/me (display name, else the e-mail user part) and the effective role. */
  get usuario(): { iniciales: string; nombre: string; rol: string } {
    const perfil = this.sesion.profile();
    const correo = perfil?.email ?? this.sesion.user()?.email;
    const nombre = perfil?.display_name?.trim() || correo?.split('@', 1)[0].trim() || 'Usuario';
    const rol = this.sesion.role();
    return {
      iniciales: nombre.slice(0, 2).toUpperCase(),
      nombre,
      rol: rol ? `Rol: ${ROLE_LABELS[rol]}` : 'Sin rol',
    };
  }

  /** Cierra la sesión activa y vuelve al Login sin mostrar errores internos del proveedor. */
  async cerrarSesion(): Promise<void> {
    this.cerrandoSesion.set(true);
    this.errorCierre.set('');
    try {
      await this.sesion.signOut();
      this.menuAbierto = false;
      await this.router.navigate(['/login']);
    } catch {
      this.errorCierre.set('No se pudo cerrar la sesión. Intenta nuevamente.');
    } finally {
      this.cerrandoSesion.set(false);
    }
  }

  /** Alterna el menú y coloca el foco dentro al abrirlo. */
  alternarMenu(): void {
    if (this.menuAbierto) this.cerrarMenu();
    else this.abrirMenu();
  }

  /** Abre el menú al usar las flechas desde el botón y conserva el foco accesible. */
  abrirConTeclado(evento: KeyboardEvent): void {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
    evento.preventDefault();
    this.abrirMenu();
  }

  /** Cierra el menú con Escape y devuelve el foco al control que lo abrió. */
  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    if (this.menuAbierto) this.cerrarMenu(true);
  }

  /** Cierra el menú al pulsar Tab para que el foco continúe en el orden de página. */
  manejarTecladoPanel(evento: KeyboardEvent): void {
    if (evento.key === 'Tab') this.cerrarMenu();
  }

  /** Cierra el menú al hacer clic fuera de esta instancia compartida. */
  @HostListener('document:click', ['$event'])
  cerrarAlHacerClicFuera(evento: MouseEvent): void {
    const destino = evento.target;
    if (
      this.menuAbierto &&
      !(destino instanceof Node && this.elemento.nativeElement.contains(destino))
    ) {
      this.cerrarMenu();
    }
  }

  private abrirMenu(): void {
    if (this.menuAbierto) {
      this.panel?.nativeElement.focus();
      return;
    }
    this.menuAbierto = true;
    setTimeout(() => this.panel?.nativeElement.focus());
  }

  private cerrarMenu(restaurarFoco = false): void {
    this.menuAbierto = false;
    if (restaurarFoco) setTimeout(() => this.trigger?.nativeElement.focus());
  }
}
