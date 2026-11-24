import { Component } from '@angular/core';
import {
  LucideActivity,
  LucideBot,
  LucideChartColumn,
  LucideClock,
  LucideCpu,
  LucideLayers,
} from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AyudaTooltip } from '../../componentes/ayuda-tooltip/ayuda-tooltip';

/**
 * Agent control screen. Its metrics, charts and ticket counters have no backend route yet, so it shows the
 * "Sin datos" states; the prototype's demo charts can be restored from commit 3e90205 when it is wired.
 */
@Component({
  selector: 'app-control-agente',
  imports: [
    BannerPagina,
    AyudaTooltip,
    LucideActivity,
    LucideBot,
    LucideChartColumn,
    LucideClock,
    LucideCpu,
    LucideLayers,
  ],
  templateUrl: './control-agente.html',
})
export class ControlAgente {
  readonly iconoBanner = LucideBot;
}
