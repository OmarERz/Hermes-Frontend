import { Component, computed, DestroyRef, inject } from '@angular/core';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { optionLabel } from '../configuration/config-model';
import { ConfigDocument, SetupService } from './setup.service';

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
 * Paso 6 · Sensibilidad y fórmula (docs/13 §9): the current sensitivity profile, its dead zone and the formula
 * weights, from `GET /api/config`. Changing them needs the simulation first (FRO-04), so it happens in
 * Configuración del juez and Fórmula, where the profile is saved together with its dead zone (D-091).
 */
@Component({
  selector: 'app-setup-sensitivity-step',
  imports: [AsyncStateComponent],
  template: `
    @switch (load.status()) {
      @case ('error') {
        <app-async-state state="error" [error]="load.error()" (retry)="reload()" />
      }
      @case ('ready') {
        <dl class="step-facts">
          <div>
            <dt>Perfil de sensibilidad</dt>
            <dd class="profile-value">{{ profile() }}</dd>
          </div>
          <div>
            <dt>Zona muerta</dt>
            <dd>{{ deadZone() }}</dd>
          </div>
          <div>
            <dt>Versión de la configuración</dt>
            <dd>v{{ load.value()?.version }}</dd>
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
          El perfil se cambia en Configuración del juez, con simulación previa, y se guarda junto
          con su zona muerta. Los pesos de fábrica sirven para empezar.
        </p>
      }
      @default {
        <app-async-state state="loading" loadingText="Cargando la configuración…" />
      }
    }
  `,
  styleUrl: './setup-step.css',
})
export class SetupSensitivityStep {
  private readonly service = inject(SetupService);

  readonly load = new AsyncState<ConfigDocument>();

  private readonly values = computed<Readonly<Record<string, string>>>(
    () => this.load.value()?.values ?? {},
  );
  readonly profile = computed(() => {
    const value = this.values()['sensitivity_profile'];
    return value ? optionLabel('sensitivity_profile', value) : '—';
  });
  readonly deadZone = computed(() => {
    const value = this.values()['dead_zone'];
    return value ? `≤ ${value}` : '—';
  });
  readonly weights = computed(() => weightsOf(this.values()));

  constructor() {
    this.reload();
    inject(DestroyRef).onDestroy(() => this.load.cancel());
  }

  reload(): void {
    this.load.run(this.service.config());
  }
}
