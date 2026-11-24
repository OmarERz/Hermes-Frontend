import { Component, computed, signal } from '@angular/core';
import { LucideBuilding2, LucideGlobe, LucideLanguages, LucideListTree } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { CompanyProfile, languageName, sectorName } from './company-labels';
import { ProfilePanel } from './profile-panel';

/**
 * Empresa (docs/13 §9 pasos 2 y 3, FRONTEND.md §3): the company profile and the peer companies, in the Activos
 * design. Every role reads them; only an admin edits (the panels hide the actions and the API enforces the role).
 */
@Component({
  selector: 'app-company-page',
  imports: [
    BannerPagina,
    ProfilePanel,
    LucideBuilding2,
    LucideGlobe,
    LucideLanguages,
    LucideListTree,
  ],
  template: `
    <div class="assets-view company-view">
      <app-banner-pagina
        titulo="Empresa"
        descripcion="Perfil de la empresa y empresas pares: el contexto con el que Hermes decide qué amenazas se parecen a tu empresa."
        [icono]="bannerIcon"
      />

      <section class="stats-grid" aria-label="Resumen del perfil">
        <article class="stat-card">
          <span><svg lucideBuilding2 aria-hidden="true"></svg></span><small>Sector principal</small>
          <strong [class.unknown]="!profile()">{{ sector() }}</strong>
        </article>
        <article class="stat-card">
          <span><svg lucideListTree aria-hidden="true"></svg></span><small>Subsectores</small>
          <strong [class.unknown]="!profile()">{{ profile()?.subsectors?.length ?? '—' }}</strong>
        </article>
        <article class="stat-card">
          <span><svg lucideGlobe aria-hidden="true"></svg></span><small>Países de operación</small>
          <strong [class.unknown]="!profile()">{{ profile()?.countries?.length ?? '—' }}</strong>
        </article>
        <article class="stat-card">
          <span><svg lucideLanguages aria-hidden="true"></svg></span><small>Idioma de salida</small>
          <strong [class.unknown]="!profile()">{{ language() }}</strong>
        </article>
      </section>

      <div class="company-grid">
        <app-profile-panel (profileChange)="profile.set($event)" />
      </div>
    </div>
  `,
  styles: `
    .stats-grid {
      margin-bottom: 18px;
    }
    .stat-card strong:not(.unknown) {
      font-size: calc(20px + var(--font-size-increase));
      overflow-wrap: anywhere;
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
