import { Component, computed, effect, inject, output } from '@angular/core';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { ConfigEditor } from '../configuration/config-editor';
import { optionLabel } from '../configuration/config-model';
import { ConfigSaveBar } from '../configuration/config-save-bar';
import { ConfigStore } from '../configuration/config-store';
import {
  chooseProfile,
  DEAD_ZONE_KEY,
  PROFILE_KEY,
  profileCards,
} from '../configuration/sensitivity-profiles';
import { SimulationPanel } from '../configuration/simulation-panel';

/** Factors of the base score, in the order of the Fórmula screen; any other weight goes last with its code. */
const FACTORS: Record<string, string> = {
  S: 'Severidad',
  P: 'Explotación',
  T: 'Contexto de amenaza',
  A: 'Activo',
  D: 'Sensibilidad de los datos',
};

export interface Weight {
  factor: string;
  name: string;
  value: string;
}

/** The `weights.<factor>` values of the configuration, known factors first. */
export function weightsOf(values: Readonly<Record<string, string>>): Weight[] {
  const order = Object.keys(FACTORS);
  const rank = (factor: string) => (order.includes(factor) ? order.indexOf(factor) : order.length);
  return Object.entries(values)
    .filter(([key]) => key.startsWith('weights.'))
    .map(([key, value]) => {
      const factor = key.slice('weights.'.length);
      return { factor, name: FACTORS[factor] ?? factor, value };
    })
    .sort((a, b) => rank(a.factor) - rank(b.factor));
}

/**
 * Paso 6 · Sensibilidad y fórmula (docs/13 §9): the admin chooses the sensitivity profile here, with the same pieces
 * as Configuración del juez: the profile travels with its dead zone (D-091), the simulation comes first (FRO-04) and
 * the save carries the version read (API-03), with the before/after confirmation. The formula weights are shown as
 * they are (the factory ones serve to start); they change in Fórmula.
 */
@Component({
  selector: 'app-setup-sensitivity-step',
  providers: [ConfigStore],
  imports: [AsyncStateComponent, SimulationPanel, ConfigSaveBar],
  template: `
    <div class="agent-config-view setup-sensitivity">
      @if (pageState(); as view) {
        <app-async-state
          [state]="view"
          loadingText="Cargando la configuración…"
          [error]="store.state.error()"
          (retry)="store.load()"
        />
      } @else {
        @if (profileParam(); as param) {
          <fieldset class="profile-options setup-profiles" [disabled]="!editor.canEdit(param)">
            <legend class="field-label">Perfil de sensibilidad del juez</legend>
            @for (profile of profiles(); track profile.value) {
              <label
                class="profile-option"
                [class.selected]="editor.value(param.key) === profile.value"
              >
                <span class="profile-option-heading"
                  ><input
                    type="radio"
                    name="setup-sensitivity-profile"
                    [value]="profile.value"
                    [checked]="editor.value(param.key) === profile.value"
                    (change)="select(profile.value)"
                /></span>
                <strong>{{ profile.label }}</strong>
                @if (profile.text) {
                  <small>{{ profile.text }}</small>
                }
                @if (profile.deadZone !== null) {
                  <small class="profile-dead-zone">Zona muerta: ≤ {{ profile.deadZone }}</small>
                }
              </label>
            }
          </fieldset>
        } @else {
          <p class="step-hint">El servidor no publica el perfil de sensibilidad.</p>
        }
        <dl class="step-facts">
          <div>
            <dt>Perfil guardado</dt>
            <dd class="profile-value">{{ savedProfile() }}</dd>
          </div>
          <div>
            <dt>Zona muerta guardada</dt>
            <dd>{{ savedDeadZone() }}</dd>
          </div>
          <div>
            <dt>Versión de la configuración</dt>
            <dd>v{{ store.version() }}</dd>
          </div>
        </dl>
        @if (weights().length) {
          <ul class="step-list weight-list" aria-label="Pesos de la fórmula">
            @for (weight of weights(); track weight.factor) {
              <li>
                <span class="item-copy"
                  ><strong>{{ weight.factor }} · {{ weight.name }}</strong></span
                >
                <span class="item-number">{{ weight.value }}</span>
              </li>
            }
          </ul>
        }
        <p class="step-hint">
          Simula el perfil antes de guardarlo; se guarda junto con su zona muerta. Los pesos de
          fábrica sirven para empezar y se cambian en Fórmula.
        </p>
        <app-simulation-panel class="setup-simulation" [editor]="editor" />
        <app-config-save-bar title="Confirmar el perfil de sensibilidad" [editor]="editor" />
      }
    </div>
  `,
  styleUrls: ['./setup-step.css', './sensitivity-step.css'],
})
export class SetupSensitivityStep {
  readonly store = inject(ConfigStore);
  readonly editor = new ConfigEditor({
    include: (param) => param.key === PROFILE_KEY || param.key === DEAD_ZONE_KEY,
    simulate: true,
  });

  /** A new configuration version was saved (the wizard reads its steps again: step 6 is done once saved). */
  readonly saved = output<void>();
  private readVersion: number | null = null;

  readonly pageState = computed<ViewState | null>(() => {
    const status = this.store.state.status();
    if (status === 'error') return 'error';
    return status === 'ready' ? null : 'loading';
  });
  readonly profileParam = computed(
    () => this.editor.parameters().find((param) => param.key === PROFILE_KEY) ?? null,
  );
  readonly profiles = computed(() => profileCards(this.profileParam()));
  readonly savedProfile = computed(() => {
    const value = this.editor.current(PROFILE_KEY);
    return value ? optionLabel(PROFILE_KEY, value) : '—';
  });
  readonly savedDeadZone = computed(() => {
    const value = this.editor.current(DEAD_ZONE_KEY);
    return value ? `≤ ${value}` : '—';
  });
  readonly weights = computed(() => weightsOf(this.store.values()));

  constructor() {
    this.store.load();
    effect(() => {
      const version = this.store.version();
      if (version === null) return;
      if (this.readVersion !== null && version !== this.readVersion) this.saved.emit();
      this.readVersion = version;
    });
  }

  select(profile: string): void {
    chooseProfile(this.editor, profile);
  }
}
