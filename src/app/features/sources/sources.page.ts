// Entry of the route (owned by lane F1): the prototype screen until the lane replaces it. The prototype has its
// own header instead of <app-banner-pagina>, so the section tabs are added here.
import { Component } from '@angular/core';
import { FeedsInteligencia } from '../../rutas/Feeds-inteligencia/feeds-inteligencia';
import { SectionTabs } from '../../shared/section-tabs';

@Component({
  selector: 'app-sources-page',
  imports: [SectionTabs, FeedsInteligencia],
  template: `<app-section-tabs /><app-feeds-inteligencia />`,
})
export class SourcesPage {}
