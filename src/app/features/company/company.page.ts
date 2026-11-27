import { Component, computed, signal } from '@angular/core';
import { LucideBuilding2, LucideGlobe, LucideLanguages, LucideListTree } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { KpiCard } from '../../shared/kpi-card';
import { CompanyProfile, languageName, sectorName } from './company-labels';
import { PeersPanel } from './peers-panel';
import { ProfilePanel } from './profile-panel';

/**
 * Empresa (docs/13 §9 pasos 2 y 3, FRONTEND.md §3): the company profile and the peer companies, in the Activos
 * design. Every role reads them; only an admin edits (the panels hide the actions and the API enforces the role).
 */
@Component({
  selector: 'app-company-page',
  imports: [BannerPagina, KpiCard, ProfilePanel, PeersPanel],
  template: `
    <div class="assets-view company-view">
      <app-banner-pagina
        titulo="Empresa"
        descripcion="Perfil de la empresa y empresas pares: el contexto con el que Hermes decide qué amenazas se parecen a tu empresa."
        [icono]="bannerIcon"
      />

      <section class="kpi-grid" aria-label="Resumen del perfil">
        <app-kpi-card
          label="Sector principal"
          [icon]="kpiIcons.sector"
          kind="text"
          [value]="profile() ? sector() : null"
        />
        <app-kpi-card
          label="Subsectores"
          [icon]="kpiIcons.subsectors"
          [value]="profile()?.subsectors?.length"
        />
        <app-kpi-card
          label="Países de operación"
          [icon]="kpiIcons.countries"
          [value]="profile()?.countries?.length"
        />
        <app-kpi-card
          label="Idioma de salida"
          [icon]="kpiIcons.language"
          kind="text"
          [value]="profile() ? language() : null"
        />
      </section>

      <div class="company-grid">
        <app-profile-panel (profileChange)="profile.set($event)" />
        <app-peers-panel />
      </div>
    </div>
  `,
  styles: `
    .kpi-grid {
      margin-bottom: var(--section-gap);
    }
    .company-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
      gap: 15px;
      align-items: start;
    }
  `,
})
export class CompanyPage {
  readonly bannerIcon = LucideBuilding2;
  /** Icons of the indicator cards. */
  readonly kpiIcons = {
    sector: LucideBuilding2,
    subsectors: LucideListTree,
    countries: LucideGlobe,
    language: LucideLanguages,
  };
  readonly profile = signal<CompanyProfile | null>(null);
  readonly sector = computed(() => {
    const current = this.profile();
    return current ? sectorName(current.sector) : '—';
  });
  readonly language = computed(() => {
    const current = this.profile();
    return current ? languageName(current.language) : '—';
  });
}
