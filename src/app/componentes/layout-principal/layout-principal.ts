import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideMoon,
  LucideSun
} from '@lucide/angular';
import { SidebarPrincipal } from '../sidebar-principal/sidebar-principal';

@Component({
  selector: 'app-layout-principal',
  imports: [RouterOutlet, SidebarPrincipal, LucideDynamicIcon],
  templateUrl: './layout-principal.html'
})
export class LayoutPrincipal {
  readonly iconoSol = LucideSun;
  readonly iconoLuna = LucideMoon;
  tema: 'dark' | 'light' = 'dark';

  alternarTema() {
    this.tema = this.tema === 'dark' ? 'light' : 'dark';
  }

}

