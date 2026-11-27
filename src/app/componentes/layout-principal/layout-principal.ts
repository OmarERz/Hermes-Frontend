import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '../../core/theme/theme.service';
import { SidebarPrincipal } from '../sidebar-principal/sidebar-principal';

/** App shell: the sidebar (the bottom bar on phones) and the page; the theme is switched from the profile menu. */
@Component({
  selector: 'app-layout-principal',
  imports: [RouterOutlet, SidebarPrincipal],
  templateUrl: './layout-principal.html',
})
export class LayoutPrincipal {
  readonly theme = inject(ThemeService);
}
