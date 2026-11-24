import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideBot, LucideFileClock, LucideGitCompareArrows } from '@lucide/angular';

@Component({
  selector: 'app-navegacion-agentes',
  imports: [RouterLink, RouterLinkActive, LucideBot, LucideFileClock, LucideGitCompareArrows],
  templateUrl: './navegacion-agentes.html',
  styleUrl: './navegacion-agentes.css',
})
export class NavegacionAgentes {}
