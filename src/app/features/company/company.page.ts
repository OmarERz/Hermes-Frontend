import { Component } from '@angular/core';
import { LucideBuilding2 } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { PeersPanel } from './peers-panel';
import { ProfilePanel } from './profile-panel';

/**
 * Empresa (docs/13 §9 pasos 2 y 3, FRONTEND.md §3): the company profile and the peer companies, in the Activos
 * design. Every role reads them; only an admin edits (the panels hide the actions and the API enforces the role).
 * No indicator row above them: it repeated the profile panel word for word (F19.6, EMP-1).
 */
@Component({
  selector: 'app-company-page',
  imports: [BannerPagina, ProfilePanel, PeersPanel],
  template: `
    <div class="assets-view company-view">
      <app-banner-pagina
        titulo="Empresa"
        descripcion="Perfil de la empresa y empresas pares: el contexto con el que Hermes decide qué amenazas se parecen a tu empresa."
        [icono]="bannerIcon"
      />

      <div class="company-grid">
        <app-profile-panel />
        <app-peers-panel />
      </div>
    </div>
  `,
  styles: `
    /* D-108 (F19.8): the profile and the peers are as tall as each other; each panel fills its host. */
    .company-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
      gap: var(--grid-gap);
      align-items: stretch;
    }
    .company-grid > * {
      display: grid;
      min-width: 0;
    }
  `,
})
export class CompanyPage {
  readonly bannerIcon = LucideBuilding2;
}
