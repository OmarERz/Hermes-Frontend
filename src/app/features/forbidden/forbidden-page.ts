import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideHouse, LucideLock, LucideShieldAlert } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { ROLE_LABELS } from '../../core/auth/roles';
import { SessionService } from '../../core/auth/session.service';

/**
 * Shown when the effective role does not reach the minimum role of a screen (SIN-1, G11): the standard banner, then
 * one state card that says it once, names the role and offers the way back as a button.
 */
@Component({
  selector: 'app-forbidden-page',
  imports: [BannerPagina, RouterLink, LucideHouse, LucideLock],
  template: `
    <app-banner-pagina
      titulo="Sin permiso"
      descripcion="Esta sección pide un rol con más permisos que el tuyo."
      [icono]="icon"
    />
    <section class="panel forbidden-state" role="alert">
      <svg lucideLock class="state-icon" aria-hidden="true"></svg>
      <h2>No tienes permiso para ver esta sección</h2>
      <p>
        Tu rol actual es <strong>{{ roleLabel() }}</strong
        >. Si lo necesitas, pide a un administrador que cambie tu rol.
      </p>
      <a class="btn btn-primary" routerLink="/inicio"
        ><svg lucideHouse aria-hidden="true"></svg> Volver al inicio</a
      >
    </section>
  `,
  styles: `
    .forbidden-state {
      display: grid;
      justify-items: center;
      gap: var(--space-3);
      max-width: 640px;
      box-sizing: border-box;
      margin: 0 auto;
      padding: var(--space-8) var(--card-pad);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: var(--shadow-1);
      color: var(--text-primary);
      text-align: center;
    }
    .state-icon {
      width: 48px;
      height: 48px;
      padding: var(--space-3);
      box-sizing: border-box;
      border-radius: var(--radius-md);
      background: var(--accent-wash);
      color: var(--accent);
    }
    h2 {
      margin: 0;
      font-size: var(--text-xl);
      line-height: var(--leading-snug);
      text-wrap: balance;
    }
    p {
      margin: 0 0 var(--space-2);
      color: var(--text-secondary);
      font-size: var(--text-md);
      line-height: var(--leading-normal);
      text-wrap: pretty;
    }
  `,
})
export class ForbiddenPage {
  readonly icon = LucideShieldAlert;
  private readonly session = inject(SessionService);
  readonly roleLabel = computed(() => {
    const role = this.session.role();
    return role ? ROLE_LABELS[role] : 'sin rol';
  });
}
