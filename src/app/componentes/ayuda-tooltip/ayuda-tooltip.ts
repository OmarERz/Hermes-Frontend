import { Component, Input } from '@angular/core';
import { LucideCircleHelp } from '@lucide/angular';

@Component({
  selector: 'app-ayuda-tooltip',
  imports: [LucideCircleHelp],
  templateUrl: './ayuda-tooltip.html',
  styleUrl: './ayuda-tooltip.css'
})
export class AyudaTooltip {
  @Input({ required: true }) texto = '';
  visible = false;
}
