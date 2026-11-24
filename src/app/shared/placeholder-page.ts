import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LucideLayers } from '@lucide/angular';
import { BannerPagina } from '../componentes/banner-pagina/banner-pagina';
import { findSection, SECTION } from '../core/navigation/navigation';

/**
 * Stand-in for a screen that a lane has not built yet: the banner (with the section tabs) and a notice, in the
 * Activos look. Each lane replaces the entry file of its route with the real screen.
 */
@Component({
  selector: 'app-placeholder-page',
  imports: [BannerPagina],
  template: `
    <div class="assets-view">
      <app-banner-pagina
        [titulo]="title"
        descripcion="Pantalla en construcción: se conecta al backend en un feature siguiente."
        [icono]="icon"
      />
      <section class="panel" role="status">
        <p class="empty">Esta pantalla todavía no está disponible.</p>
      </section>
    </div>
  `,
})
export class PlaceholderPage {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.title ?? 'Hermes Control';
  readonly icon = findSection(this.route.snapshot.data[SECTION])?.icon ?? LucideLayers;
}
