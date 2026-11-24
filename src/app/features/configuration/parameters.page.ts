import { Component, computed, inject } from '@angular/core';
import { LucideLayers, LucideSettings, LucideSlidersHorizontal } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { ConfigEditor } from './config-editor';
import { ConfigField } from './config-field';
import { ConfigParameter, groupLabel } from './config-model';
import { ConfigSaveBar } from './config-save-bar';
import { ConfigStore } from './config-store';
import { ConfigVersions } from './config-versions';
import { LockedProtections } from './locked-protections';

/** Groups the API publishes today, in reading order; a group the API adds goes after them. */
const GROUP_ORDER = [
  'analysts',
  'scan',
  'ingestion',
  'correlation',
  'notifications',
  'tickets',
  'sources',
  'calibration',
  'llm',
  'budget',
  'retention',
];

/** Screens with their own editor: the formula and the judge. */
const OWN_SCREENS = new Set(['formula', 'judge']);

interface ParameterGroup {
  code: string;
  name: string;
  parameters: ConfigParameter[];
}

/**
 * Parámetros: every other parameter of `GET /api/config/schema` (API-05), one card per group, generated from the
 * schema so a parameter the API adds appears without changing the front. Each one is editable from its own
 * `min_role` (some are free for analysts); none of them has a preview, so saving goes straight to the
 * before/after confirmation with the version read (API-03).
 */
@Component({
  selector: 'app-parameters-page',
  providers: [ConfigStore],
  imports: [
    BannerPagina,
    AsyncStateComponent,
    ConfigField,
    ConfigSaveBar,
    ConfigVersions,
    LockedProtections,
    LucideLayers,
    LucideSettings,
    LucideSlidersHorizontal,
  ],
  template: `
    <div class="agent-config-view parameters-view">
      <app-banner-pagina
        titulo="Parámetros"
        descripcion="Parámetros de operación del sistema que publica el servidor, por grupo. Cada uno indica su rango y quién lo puede cambiar."
        [icono]="bannerIcon"
      />
      @if (pageState(); as view) {
        <section class="config-card">
          <app-async-state
            [state]="view"
            loadingText="Cargando los parámetros…"
            emptyText="El servidor no publica otros parámetros."
            [error]="store.state.error()"
            (retry)="store.load()"
          />
        </section>
      } @else {
        <section class="config-summary" aria-label="Resumen de los parámetros">
          <article>
            <span class="summary-icon"><svg lucideLayers aria-hidden="true"></svg></span>
            <span class="summary-copy"
              ><small>Versión de configuración</small><strong>v{{ store.version() }}</strong></span
            >
          </article>
          <article>
            <span class="summary-icon"><svg lucideSettings aria-hidden="true"></svg></span>
            <span class="summary-copy"
              ><small>Parámetros</small
              ><strong
                >{{ editor.parameters().length }} en {{ groups().length }} grupos</strong
              ></span
            >
          </article>
          <article>
            <span class="summary-icon"><svg lucideSlidersHorizontal aria-hidden="true"></svg></span>
            <span class="summary-copy"
              ><small>Cambios sin guardar</small><strong>{{ editor.changeCount() }}</strong></span
            >
          </article>
        </section>
        <div class="groups-grid">
          @for (group of groups(); track group.code) {
            <section class="config-card" [attr.aria-label]="group.name">
              <header>
                <h2><svg lucideSettings aria-hidden="true"></svg> {{ group.name }}</h2>
              </header>
              <div class="field-list">
                @for (param of group.parameters; track param.key) {
                  <app-config-field
                    [param]="param"
                    [label]="param.description"
                    [hint]="roleHint(param)"
                    [value]="editor.value(param.key)"
                    [editable]="editor.canEdit(param)"
                    [changed]="editor.isChanged(param.key)"
                    [error]="editor.fieldErrors()[param.key]"
                    (valueChange)="editor.set(param.key, $event)"
                  />
                }
              </div>
            </section>
          }
        </div>
        <app-config-save-bar title="Confirmar cambios de parámetros" [editor]="editor" />
        <app-config-versions class="block" (restored)="editor.discard()" />
        <app-locked-protections class="block" [parameters]="editor.parameters()" />
      }
    </div>
  `,
  styles: `
    .groups-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .field-list {
      display: grid;
      gap: 8px;
    }
    .block {
      display: block;
      margin-top: 14px;
    }
    @media (max-width: 900px) {
      .groups-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class ParametersPage {
  readonly store = inject(ConfigStore);
  readonly editor = new ConfigEditor({
    include: (param) => !OWN_SCREENS.has(param.group),
    simulate: false,
  });

  readonly bannerIcon = LucideSettings;
  readonly groups = computed<ParameterGroup[]>(() => {
    const byGroup = new Map<string, ConfigParameter[]>();
    for (const param of this.editor.parameters()) {
      byGroup.set(param.group, [...(byGroup.get(param.group) ?? []), param]);
    }
    const rank = (code: string) => {
      const index = GROUP_ORDER.indexOf(code);
      return index < 0 ? GROUP_ORDER.length : index;
    };
    return [...byGroup.entries()]
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
      .map(([code, parameters]) => ({ code, name: groupLabel(code), parameters }));
  });

  readonly pageState = computed<ViewState | null>(() => {
    const status = this.store.state.status();
    if (status === 'error') return 'error';
    if (status !== 'ready') return 'loading';
    return this.editor.parameters().length ? null : 'empty';
  });

  constructor() {
    this.store.load();
  }

  /** Who can change it, when it is not only the administrator. */
  roleHint(param: ConfigParameter): string {
    if (param.level === 'blocked') return '';
    if (param.min_role === 'analyst') return 'Lo puede cambiar un analista o un administrador.';
    return param.min_role === 'reader' ? 'Lo puede cambiar cualquier usuario.' : '';
  }
}
