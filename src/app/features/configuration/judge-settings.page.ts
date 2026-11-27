import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideBot,
  LucideBrain,
  LucideDynamicIcon,
  LucideGauge,
  LucideHourglass,
  LucideIconInput,
  LucideLayers,
  LucideListChecks,
  LucideRepeat2,
  LucideRocket,
  LucideScale,
  LucideShieldCheck,
  LucideSlidersHorizontal,
  LucideTarget,
  LucideTurtle,
} from '@lucide/angular';
import { AyudaTooltip } from '../../componentes/ayuda-tooltip/ayuda-tooltip';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { ConfigEditor } from './config-editor';
import { ConfigField } from './config-field';
import { ConfigParameter, displayValue, reasonCode, reasonLabel } from './config-model';
import { ConfigSaveBar } from './config-save-bar';
import { ConfigStore } from './config-store';
import { LockedProtections } from './locked-protections';
import { chooseProfile, followsProfile, PROFILE_KEY, profileCards } from './sensitivity-profiles';
import { SimulationPanel } from './simulation-panel';

const PROFILE_ICONS: Record<string, LucideIconInput> = {
  minimal: LucideTurtle,
  normal: LucideScale,
  broad: LucideRocket,
};

/** What the advanced parameters of docs/07 do; any other parameter shows only its description. */
const HINTS: Record<string, string> = {
  double_review_threshold:
    'Un ajuste del juez de esta magnitud o mayor pide una segunda revisión ciega.',
  double_review_max_diff: 'Si las dos revisiones difieren más que esto, se aplica solo la base.',
  dead_zone: 'Un ajuste neto del juez menor o igual a este valor no se aplica (se registra igual).',
  complex_reasoning_mode:
    'Activa el modo de razonamiento del modelo del juez para el presupuesto complejo.',
  'mode2.min_confidence': 'Confianza mínima para publicar una alerta inferida (modo 2).',
};
const ICONS: Record<string, LucideIconInput> = {
  double_review_threshold: LucideRepeat2,
  double_review_max_diff: LucideScale,
  dead_zone: LucideTarget,
  complex_reasoning_mode: LucideBrain,
  'mode2.min_confidence': LucideGauge,
  'judge.max_calls': LucideHourglass,
  'judge.max_rejections': LucideListChecks,
};

/**
 * Configuración del juez (FRO-02, FRO-03, CO-1): the sensitivity profile and the advanced mode, both generated
 * from the `judge` group of `GET /api/config/schema` (only the parameters the API publishes; the prototype's
 * autonomy slider and tool toggles are gone: the judge never acts, L8). The reason toggles
 * (`reasons.<code>.enabled`) appear when the API lists them. Saving needs a simulation first (FRO-04) and goes
 * through the before/after confirmation with the version read (API-03). Writes: admin only.
 */
@Component({
  selector: 'app-judge-settings-page',
  providers: [ConfigStore],
  imports: [
    RouterLink,
    AyudaTooltip,
    BannerPagina,
    AsyncStateComponent,
    ConfigField,
    ConfigSaveBar,
    LockedProtections,
    SimulationPanel,
    LucideBot,
    LucideDynamicIcon,
    LucideLayers,
    LucideListChecks,
    LucideScale,
    LucideShieldCheck,
    LucideSlidersHorizontal,
  ],
  templateUrl: './judge-settings-page.html',
  styleUrl: './judge-settings-page.css',
})
export class JudgeSettingsPage {
  readonly store = inject(ConfigStore);
  readonly editor = new ConfigEditor({
    include: (param) => param.group === 'judge',
    simulate: true,
  });

  readonly bannerIcon = LucideSlidersHorizontal;
  readonly advanced = signal(false);

  readonly profileParam = computed(
    () => this.editor.parameters().find((param) => param.key === PROFILE_KEY) ?? null,
  );
  readonly profiles = computed(() =>
    profileCards(this.profileParam()).map((card) => ({
      ...card,
      icon: PROFILE_ICONS[card.value] ?? LucideSlidersHorizontal,
    })),
  );
  readonly currentProfile = computed(() => {
    const param = this.profileParam();
    return param ? displayValue(param, this.editor.current(param.key)) : 'Sin datos';
  });
  readonly advancedParams = computed(() =>
    this.editor.parameters().filter((param) => param.key !== PROFILE_KEY && !reasonCode(param)),
  );
  readonly reasons = computed(() =>
    this.editor.parameters().filter((param) => reasonCode(param) !== null),
  );
  readonly activeReasons = computed(
    () => this.reasons().filter((param) => this.editor.value(param.key) === 'true').length,
  );
  /**
   * Advanced changes keep the advanced mode open, so nothing unsaved is hidden. The dead zone a chosen profile brought
   * along is part of the profile change (its card shows it), not an advanced one.
   */
  readonly advancedChanged = computed(() =>
    [...this.advancedParams(), ...this.reasons()].some(
      (param) => this.editor.isChanged(param.key) && !followsProfile(this.editor, param.key),
    ),
  );
  readonly showAdvanced = computed(() => this.advanced() || this.advancedChanged());

  readonly pageState = computed<ViewState | null>(() => {
    const status = this.store.state.status();
    if (status === 'error') return 'error';
    return status === 'ready' ? null : 'loading';
  });

  constructor() {
    this.store.load();
  }

  /** Drafts a profile together with its dead zone (D-091). */
  selectProfile(profile: string): void {
    chooseProfile(this.editor, profile);
  }

  hint(param: ConfigParameter): string {
    return HINTS[param.key] ?? '';
  }

  icon(param: ConfigParameter): LucideIconInput {
    return ICONS[param.key] ?? LucideSlidersHorizontal;
  }

  reasonLabel(param: ConfigParameter): string {
    return reasonLabel(param);
  }

  setAdvanced(event: Event): void {
    this.advanced.set((event.target as HTMLInputElement).checked);
  }
}
