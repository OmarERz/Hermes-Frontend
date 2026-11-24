import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { MIN_ROLE } from './core/auth/roles';

const seccionSidebarAgentes = { sidebarSection: 'agentes' };

/**
 * Every screen is lazy-loaded, so the initial bundle only carries the bootstrap, the router, the session and
 * Firebase Auth. Each child declares its minimum role in `data.minRole` (reader when absent), taken from the
 * backend ROUTE_ROLES of the routes it calls.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./rutas/Login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [roleGuard],
    loadComponent: () =>
      import('./componentes/layout-principal/layout-principal').then((m) => m.LayoutPrincipal),
    children: [
      {
        path: 'inicio',
        loadComponent: () => import('./rutas/Inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'sin-permiso',
        loadComponent: () =>
          import('./features/forbidden/forbidden-page').then((m) => m.ForbiddenPage),
      },
      {
        path: 'agentes',
        data: seccionSidebarAgentes,
        loadComponent: () => import('./rutas/Agentes/control-agente').then((m) => m.ControlAgente),
      },
      {
        path: 'configuracion-agente',
        loadComponent: () =>
          import('./rutas/Configuracion-agente/configuracion-agente').then(
            (m) => m.ConfiguracionAgente,
          ),
      },
      {
        path: 'feeds',
        loadComponent: () =>
          import('./rutas/Feeds-inteligencia/feeds-inteligencia').then((m) => m.FeedsInteligencia),
      },
      {
        path: 'historial-agente',
        data: seccionSidebarAgentes,
        loadComponent: () =>
          import('./rutas/Historial-agente/historial-agente').then((m) => m.HistorialAgente),
      },
      {
        path: 'recomendaciones-agente',
        data: seccionSidebarAgentes,
        loadComponent: () =>
          import('./rutas/Recomendaciones-agente/recomendaciones-agente').then(
            (m) => m.RecomendacionesAgente,
          ),
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
      {
        path: 'stack-tecnologico',
        loadComponent: () =>
          import('./rutas/Stack-tecnologico/stack-tecnologico').then((m) => m.StackTecnologico),
      },
      {
        path: 'vulnerabilidades',
        data: { [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/vulnerabilities/vulnerabilities-page').then(
            (m) => m.VulnerabilitiesPage,
          ),
      },
      {
        path: 'activos',
        loadComponent: () => import('./rutas/Activos/activos').then((m) => m.Activos),
      },
      { path: 'registrar-activo', redirectTo: 'activos', pathMatch: 'full' },
      { path: 'asignar-stack', redirectTo: 'stack-tecnologico', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
