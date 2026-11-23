import { Component, Input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-banner-pagina',
  imports: [LucideDynamicIcon],
  templateUrl: './banner-pagina.html'
})
export class BannerPagina {
  @Input({ required: true }) titulo = '';
  @Input({ required: true }) descripcion = '';
  @Input({ required: true }) icono: any;
}
