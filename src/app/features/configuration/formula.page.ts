import { Component, computed, inject, signal } from '@angular/core';
import {
  LucideHourglass,
  LucideLayers,
  LucideScale,
  LucideSigma,
  LucideSlidersHorizontal,
  LucideTriangleAlert,
} from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { ConfigEditor } from './config-editor';
import { ConfigField } from './config-field';
import { ConfigParameter, formatWeightsTotal, weightsSumToOne } from './config-model';
import { ConfigSaveBar } from './config-save-bar';
import { ConfigStore } from './config-store';
import { ConfigVersions } from './config-versions';
import { FactorLevels, formulaLabel, formulaLayout, shortFormulaLabel } from './formula-layout';
import { LockedProtections } from './locked-protections';
import { SimulationPanel } from './simulation-panel';

/**
 * Fórmula del motor (FRO-05 to FRO-08): weights, factor levels, urgency bands, decay and the remaining formula
 * parameters, generated from the `formula` group of `GET /api/config/schema`. The weights sum is checked as the
 * person types; the API validates everything again and its issues are shown per field and per rule. Saving
 * needs a simulation of the exact draft (`POST /api/formula/simulate`) and recalculates without the judge.
 * Writes: admin only.
 */
@Component({
  selector: 'app-formula-page',
  providers: [ConfigStore],
  imports: [
    BannerPagina,
    AsyncStateComponent,
    ConfigField,
    ConfigSaveBar,
    ConfigVersions,
    LockedProtections,
    SimulationPanel,
    LucideHourglass,
    LucideLayers,
    LucideScale,
    LucideSigma,
    LucideSlidersHorizontal,
    LucideTriangleAlert,
  ],
  templateUrl: './formula-page.html',
  styleUrl: './formula-page.css',
})
export class FormulaPage {
  readonly store = inject(ConfigStore);
  readonly editor = new ConfigEditor({
    include: (param) => param.group === 'formula',
    simulate: true,
    label: formulaLabel,
  });

  readonly bannerIcon = LucideSigma;
  readonly layout = computed(() => formulaLayout(this.editor.parameters()));
  readonly weightsText = computed(() => formatWeightsTotal(this.editor.weightsTotal()));
  readonly weightsOk = computed(() => weightsSumToOne(this.editor.weightsTotal()));
  /** N-19: on phones each «Niveles de …» group folds behind its button (the page was ≈ 8.5 screens long). */
  readonly openLevels = signal<ReadonlySet<string>>(new Set());

  readonly pageState = computed<ViewState | null>(() => {
    const status = this.store.state.status();
    if (status === 'error') return 'error';
    if (status !== 'ready') return 'loading';
    return this.editor.parameters().length ? null : 'empty';
  });

  constructor() {
    this.store.load();
  }

  /** A group shows its levels when the person opened it or one of them has an error to read. */
  levelsShown(group: FactorLevels): boolean {
    const errors = this.editor.fieldErrors();
    return (
      this.openLevels().has(group.factor) || group.parameters.some((param) => !!errors[param.key])
    );
  }

  toggleLevels(factor: string): void {
    this.openLevels.update((open) => {
      const next = new Set(open);
      if (!next.delete(factor)) next.add(factor);
      return next;
    });
  }

  label(param: ConfigParameter): string {
    return shortFormulaLabel(param);
  }
}
