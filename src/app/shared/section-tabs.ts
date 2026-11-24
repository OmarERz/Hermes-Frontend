import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ActiveSection } from '../core/navigation/active-section.service';

/**
 * Tabs of the current section (the prototype's Agents tabs, for every section). Rendered by the page banner, so
 * every screen that starts with `<app-banner-pagina>` gets them; hidden when the section has a single tab the
 * role can open.
 */
@Component({
  selector: 'app-section-tabs',
  imports: [RouterLink, RouterLinkActive, LucideDynamicIcon],
  template: `
    @if (navigation.tabs().length > 1) {
      <nav class="section-tabs" [attr.aria-label]="'Secciones de ' + navigation.current()?.label">
        @for (tab of navigation.tabs(); track tab.path) {
          <a [routerLink]="'/' + tab.path" routerLinkActive="active" ariaCurrentWhenActive="page"
            ><svg [lucideIcon]="tab.icon" aria-hidden="true"></svg><span>{{ tab.label }}</span></a
          >
        }
      </nav>
    }
  `,
  styleUrl: './section-tabs.css',
})
export class SectionTabs {
  readonly navigation = inject(ActiveSection);
}
