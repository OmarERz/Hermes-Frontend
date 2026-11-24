import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ActiveSection } from '../../core/navigation/active-section.service';
import { MenuPerfil } from '../menu-perfil/menu-perfil';

/**
 * Main navigation: one entry per section of `core/navigation/navigation.ts` that the role can open, linking to
 * its first tab; the active entry follows the `data.section` of the current route.
 */
@Component({
  selector: 'app-sidebar-principal',
  imports: [RouterLink, LucideDynamicIcon, MenuPerfil],
  templateUrl: './sidebar-principal.html',
})
export class SidebarPrincipal {
  readonly navigation = inject(ActiveSection);
}
