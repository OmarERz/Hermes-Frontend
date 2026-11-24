import { Component, Input } from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { SectionTabs } from '../../shared/section-tabs';

@Component({
  selector: 'app-banner-pagina',
  imports: [LucideDynamicIcon, SectionTabs],
  templateUrl: './banner-pagina.html',
})
export class BannerPagina {
  @Input({ required: true }) titulo = '';
  @Input({ required: true }) descripcion = '';
  @Input({ required: true }) icono!: LucideIconInput;
}
