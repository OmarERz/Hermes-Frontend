import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideShieldAlert } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { ROLE_LABELS } from '../../core/auth/roles';
import { SessionService } from '../../core/auth/session.service';

/** Shown when the effective role does not reach the minimum role of a screen. */
@Component({
  selector: 'app-forbidden-page',
  imports: [BannerPagina, RouterLink],
  template: `
    <app-banner-pagina
      titulo="Sin permiso"
      descripcion="Tu rol no permite ver esta sección."
      [icono]="icon"
    />
    <section class="panel" role="alert">
      <p>
        No tienes permiso para ver esta sección. Tu rol actual es
        <strong>{{ roleLabel() }}</strong
        >. Si lo necesitas, pide a un administrador que cambie tu rol.
      </p>
      <p><a routerLink="/inicio">Volver al inicio</a></p>
    </section>
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
