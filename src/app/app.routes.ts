import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { MIN_ROLE } from './core/auth/roles';
import { SECTION } from './core/navigation/route-data';

/**
 * Route table. Every screen is lazy-loaded from its **entry file** (`features/<area>/<name>.page.ts`), owned by the
 * lane that builds it: a lane replaces its entry file and never edits this table. Each route carries its section
 * (`data.section`), its minimum role (`data.minRole`, from the backend ROUTE_ROLES) and its title; the navigation
 * in `core/navigation/navigation.ts` lists the same paths and roles (a test keeps both in sync).
 */
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    title: 'Iniciar sesión',
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
      // Inicio
      {
        path: 'inicio',
        title: 'Inicio',
        data: { [SECTION]: 'home', [MIN_ROLE]: 'reader' },
        loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'sin-permiso',
        title: 'Sin permiso',
        loadComponent: () =>
          import('./features/forbidden/forbidden-page').then((m) => m.ForbiddenPage),
      },

      // Agentes (lanes A and D)
      {
        path: 'agentes',
        title: 'Panel de agentes',
        data: { [SECTION]: 'agents', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/agents/agents-dashboard.page').then((m) => m.AgentsDashboardPage),
      },
      {
        path: 'historial-agente',
        title: 'Historial',
        data: { [SECTION]: 'agents', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/agents/agents-history.page').then((m) => m.AgentsHistoryPage),
      },
      {
        path: 'recomendaciones-agente',
        title: 'Recomendaciones',
        data: { [SECTION]: 'agents', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/recommendations/recommendations.page').then(
            (m) => m.RecommendationsPage,
          ),
      },
      {
        path: 'metricas',
        title: 'Métricas',
        data: { [SECTION]: 'agents', [MIN_ROLE]: 'reader' },
        loadComponent: () => import('./features/agents/metrics.page').then((m) => m.MetricsPage),
      },

      // Vulnerabilidades (lane C)
      {
        path: 'vulnerabilidades',
        title: 'Vulnerabilidades',
        data: { [SECTION]: 'vulnerabilities', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/vulnerabilities/vulnerabilities.page').then(
            (m) => m.VulnerabilitiesPage,
          ),
      },
      {
        path: 'vulnerabilidades/:groupId',
        title: 'Detalle de vulnerabilidad',
        data: { [SECTION]: 'vulnerabilities', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/vulnerabilities/vulnerability-detail.page').then(
            (m) => m.VulnerabilityDetailPage,
          ),
      },
      {
        path: 'comparacion',
        title: 'Comparación',
        data: { [SECTION]: 'vulnerabilities', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/vulnerabilities/comparison.page').then((m) => m.ComparisonPage),
      },
      {
        path: 'tickets',
        title: 'Tickets y alertas',
        data: { [SECTION]: 'vulnerabilities', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/vulnerabilities/tickets.page').then((m) => m.TicketsPage),
      },
      {
        path: 'exportacion-stix',
        title: 'Exportación STIX',
        data: { [SECTION]: 'vulnerabilities', [MIN_ROLE]: 'analyst' },
        loadComponent: () =>
          import('./features/vulnerabilities/stix-export.page').then((m) => m.StixExportPage),
      },

      // Inventario (lane B)
      {
        path: 'activos',
        title: 'Activos',
        data: { [SECTION]: 'inventory', [MIN_ROLE]: 'reader' },
        loadComponent: () => import('./features/inventory/assets.page').then((m) => m.AssetsPage),
      },
      {
        path: 'activos/:ciId',
        title: 'Detalle de activo',
        data: { [SECTION]: 'inventory', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/inventory/asset-detail.page').then((m) => m.AssetDetailPage),
      },
      {
        path: 'software',
        title: 'Software',
        data: { [SECTION]: 'inventory', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/inventory/software.page').then((m) => m.SoftwarePage),
      },
      {
        path: 'pendientes-inventario',
        title: 'Pendientes de inventario',
        data: { [SECTION]: 'inventory', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/inventory/pending-inventory.page').then((m) => m.PendingInventoryPage),
      },

      // Configuración (lanes E and F1)
      {
        path: 'configuracion-agente',
        title: 'Configuración del juez',
        data: { [SECTION]: 'configuration', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/configuration/judge-settings.page').then((m) => m.JudgeSettingsPage),
      },
      {
        path: 'formula',
        title: 'Fórmula',
        data: { [SECTION]: 'configuration', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/configuration/formula.page').then((m) => m.FormulaPage),
      },
      {
        path: 'parametros',
        title: 'Parámetros',
        data: { [SECTION]: 'configuration', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/configuration/parameters.page').then((m) => m.ParametersPage),
      },
      {
        path: 'calibracion',
        title: 'Calibración',
        data: { [SECTION]: 'configuration', [MIN_ROLE]: 'reader' },
        loadComponent: () =>
          import('./features/configuration/calibration.page').then((m) => m.CalibrationPage),
      },
      {
        path: 'fuentes',
        title: 'Fuentes',
        data: { [SECTION]: 'configuration', [MIN_ROLE]: 'reader' },
        loadComponent: () => import('./features/sources/sources.page').then((m) => m.SourcesPage),
      },
      {
        path: 'empresa',
        title: 'Empresa',
        data: { [SECTION]: 'configuration', [MIN_ROLE]: 'reader' },
        loadComponent: () => import('./features/company/company.page').then((m) => m.CompanyPage),
      },

      // Operación (lanes F1, F2 and the setup wizard)
      {
        path: 'corridas',
        title: 'Corridas',
        data: { [SECTION]: 'operations', [MIN_ROLE]: 'reader' },
        loadComponent: () => import('./features/runs/runs.page').then((m) => m.RunsPage),
      },
      {
        path: 'usuarios',
        title: 'Usuarios y roles',
        data: { [SECTION]: 'operations', [MIN_ROLE]: 'admin' },
        loadComponent: () => import('./features/admin/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'conexiones',
        title: 'Conexiones',
        data: { [SECTION]: 'operations', [MIN_ROLE]: 'admin' },
        loadComponent: () =>
          import('./features/connections/connections.page').then((m) => m.ConnectionsPage),
      },
      {
        path: 'auditoria',
        title: 'Auditoría',
        data: { [SECTION]: 'operations', [MIN_ROLE]: 'admin' },
        loadComponent: () => import('./features/admin/audit.page').then((m) => m.AuditPage),
      },
      {
        path: 'cola-errores',
        title: 'Cola de errores',
        data: { [SECTION]: 'operations', [MIN_ROLE]: 'admin' },
        loadComponent: () =>
          import('./features/admin/error-queue.page').then((m) => m.ErrorQueuePage),
      },
      {
        path: 'asistente',
        title: 'Asistente de configuración',
        data: { [SECTION]: 'operations', [MIN_ROLE]: 'admin' },
        loadComponent: () => import('./features/setup/setup.page').then((m) => m.SetupPage),
      },

      // Old prototype paths
      {
        path: 'revision-humana',
        redirectTo: (snapshot) =>
          inject(Router).createUrlTree(['/recomendaciones-agente'], {
            queryParams: snapshot.queryParams,
            fragment: snapshot.fragment ?? undefined,
          }),
        pathMatch: 'full',
      },
      { path: 'stack-tecnologico', redirectTo: 'software', pathMatch: 'full' },
      { path: 'feeds', redirectTo: 'fuentes', pathMatch: 'full' },
      { path: 'registrar-activo', redirectTo: 'activos', pathMatch: 'full' },
      { path: 'asignar-stack', redirectTo: 'software', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
