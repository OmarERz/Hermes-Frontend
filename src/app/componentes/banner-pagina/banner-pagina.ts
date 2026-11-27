import { Component, Input } from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { SectionTabs } from '../../shared/section-tabs';

/**
 * Page banner of every screen but the home: icon tile, title (the page's h1) and description, then the tabs of the
 * section. It carries its own spacing (--section-gap to the tabs and to the content).
 */
@Component({
  selector: 'app-banner-pagina',
  imports: [LucideDynamicIcon, SectionTabs],
  templateUrl: './banner-pagina.html',
  styleUrl: './banner-pagina.css',
})
export class BannerPagina {
  @Input({ required: true }) titulo = '';
  @Input({ required: true }) descripcion = '';
  @Input({ required: true }) icono!: LucideIconInput;
}
