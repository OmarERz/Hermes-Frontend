import { Component, computed, inject } from '@angular/core';
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
import { formulaLabel, formulaLayout, shortFormulaLabel } from './formula-layout';
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

  readonly pageState = computed<ViewState | null>(() => {
    const status = this.store.state.status();
    if (status === 'error') return 'error';
    if (status !== 'ready') return 'loading';
    return this.editor.parameters().length ? null : 'empty';
  });

  constructor() {
    this.store.load();
  }

  label(param: ConfigParameter): string {
    return shortFormulaLabel(param);
  }
}
