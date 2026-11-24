import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { LayoutPrincipal } from './componentes/layout-principal/layout-principal';
import { Login } from './rutas/Login/login';
import { Activos } from './rutas/Activos/activos';
import { ControlAgente } from './rutas/Agentes/control-agente';
import { StackTecnologico } from './rutas/Stack-tecnologico/stack-tecnologico';
import { ConfiguracionAgente } from './rutas/Configuracion-agente/configuracion-agente';
import { HistorialAgente } from './rutas/Historial-agente/historial-agente';
import { RecomendacionesAgente } from './rutas/Recomendaciones-agente/recomendaciones-agente';
import { Inicio } from './rutas/Inicio/inicio';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { ForbiddenPage } from './features/forbidden/forbidden-page';

const seccionSidebarAgentes = { sidebarSection: 'agentes' };

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login, canActivate: [guestGuard] },
  {
    path: '',
    component: LayoutPrincipal,
    canActivate: [authGuard],
    // Each child declares its minimum role in data.minRole (reader when absent), as in the backend ROUTE_ROLES.
    canActivateChild: [roleGuard],
    children: [
      { path: 'inicio', component: Inicio },
      { path: 'sin-permiso', component: ForbiddenPage },
      { path: 'agentes', component: ControlAgente, data: seccionSidebarAgentes },
      { path: 'configuracion-agente', component: ConfiguracionAgente },
      {
        path: 'feeds',
        loadComponent: () =>
          import('./rutas/Feeds-inteligencia/feeds-inteligencia').then(
            (modulo) => modulo.FeedsInteligencia,
          ),
      },
      { path: 'historial-agente', component: HistorialAgente, data: seccionSidebarAgentes },
      {
        path: 'recomendaciones-agente',
        component: RecomendacionesAgente,
        data: seccionSidebarAgentes,
      },
      {
        path: 'revision-humana',
        redirectTo: (snapshot) =>
          inject(Router).createUrlTree(['/recomendaciones-agente'], {
            queryParams: snapshot.queryParams,
            fragment: snapshot.fragment ?? undefined,
          }),
        pathMatch: 'full',
      },
      { path: 'stack-tecnologico', component: StackTecnologico },
      { path: 'activos', component: Activos },
      { path: 'registrar-activo', redirectTo: 'activos', pathMatch: 'full' },
      { path: 'asignar-stack', redirectTo: 'stack-tecnologico', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
