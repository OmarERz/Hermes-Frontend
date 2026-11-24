import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ActiveSection } from '../core/navigation/active-section.service';

/**
 * Tabs of the current section (the prototype's Agents tabs, for every section). Rendered by the page banner, so
 * every screen that starts with `<app-banner-pagina>` gets them; hidden when the section has a single tab the
 * role can open.
 */
@Component({
  selector: 'app-section-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    @if (navigation.tabs().length > 1) {
      <nav class="section-tabs" [attr.aria-label]="'Secciones de ' + navigation.current()?.label">
        @for (tab of navigation.tabs(); track tab.path) {
          <a [routerLink]="'/' + tab.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{
            tab.label
          }}</a>
        }
      </nav>
    }
  `,
  styleUrl: './section-tabs.css',
})
export class SectionTabs {
  readonly navigation = inject(ActiveSection);
}
