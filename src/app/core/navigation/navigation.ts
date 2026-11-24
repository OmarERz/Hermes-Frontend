import {
  LucideBot,
  LucideBuilding2,
  LucideChartColumn,
  LucideClipboardList,
  LucideDownload,
  LucideFileClock,
  LucideFileSearch,
  LucideGitCompareArrows,
  LucideHouse,
  LucideIconInput,
  LucideLayers,
  LucideMonitor,
  LucidePlay,
  LucidePlug,
  LucideRss,
  LucideScale,
  LucideServerCog,
  LucideSettings,
  LucideShieldAlert,
  LucideSigma,
  LucideSlidersHorizontal,
  LucideTarget,
  LucideTicket,
  LucideTriangleAlert,
  LucideUsers,
  LucideWandSparkles,
} from '@lucide/angular';
import type { Role } from '../api/api-types';
import type { SectionId } from './route-data';

export { SECTION, type SectionId } from './route-data';

export interface NavTab {
  icon: LucideIconInput;
  label: string;
  /** Route path without the leading slash, as in app.routes.ts. */
  path: string;
  /** Minimum role of the screen: the backend role of the routes it reads (ROUTE_ROLES). */
  minRole: Role;
}

export interface NavSection {
  id: SectionId;
  label: string;
  icon: LucideIconInput;
  tabs: NavTab[];
}

/**
 * The navigation of the app: one sidebar entry per section and one tab per screen (shown under the page banner
 * when the section has more than one). Single source for the sidebar, the tabs and the route table test.
 */
export const SECTIONS: readonly NavSection[] = [
  {
    id: 'home',
    label: 'Inicio',
    icon: LucideHouse,
    tabs: [{ icon: LucideHouse, label: 'Inicio', path: 'inicio', minRole: 'reader' }],
  },
  {
    id: 'agents',
    label: 'Agentes',
    icon: LucideBot,
    tabs: [
      { icon: LucideBot, label: 'Panel', path: 'agentes', minRole: 'reader' },
      { icon: LucideFileClock, label: 'Historial', path: 'historial-agente', minRole: 'reader' },
      {
        icon: LucideGitCompareArrows,
        label: 'Recomendaciones',
        path: 'recomendaciones-agente',
        minRole: 'reader',
      },
      { icon: LucideChartColumn, label: 'Métricas', path: 'metricas', minRole: 'reader' },
    ],
  },
  {
    id: 'vulnerabilities',
    label: 'Vulnerabilidades',
    icon: LucideShieldAlert,
    tabs: [
      { icon: LucideShieldAlert, label: 'Por grupo', path: 'vulnerabilidades', minRole: 'reader' },
      { icon: LucideScale, label: 'Comparación', path: 'comparacion', minRole: 'reader' },
      { icon: LucideTicket, label: 'Tickets y alertas', path: 'tickets', minRole: 'reader' },
      {
        icon: LucideDownload,
        label: 'Exportación STIX',
        path: 'exportacion-stix',
        minRole: 'analyst',
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventario',
    icon: LucideMonitor,
    tabs: [
      { icon: LucideMonitor, label: 'Activos', path: 'activos', minRole: 'reader' },
      { icon: LucideLayers, label: 'Software', path: 'software', minRole: 'reader' },
      {
        icon: LucideClipboardList,
        label: 'Pendientes',
        path: 'pendientes-inventario',
        minRole: 'reader',
      },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuración',
    icon: LucideSlidersHorizontal,
    tabs: [
      {
        icon: LucideSlidersHorizontal,
        label: 'Juez',
        path: 'configuracion-agente',
        minRole: 'reader',
      },
      { icon: LucideSigma, label: 'Fórmula', path: 'formula', minRole: 'reader' },
      { icon: LucideSettings, label: 'Parámetros', path: 'parametros', minRole: 'reader' },
      { icon: LucideTarget, label: 'Calibración', path: 'calibracion', minRole: 'reader' },
      { icon: LucideRss, label: 'Fuentes', path: 'fuentes', minRole: 'reader' },
      { icon: LucideBuilding2, label: 'Empresa', path: 'empresa', minRole: 'reader' },
    ],
  },
  {
    id: 'operations',
    label: 'Operación',
    icon: LucideServerCog,
    tabs: [
      { icon: LucidePlay, label: 'Corridas', path: 'corridas', minRole: 'reader' },
      { icon: LucideUsers, label: 'Usuarios', path: 'usuarios', minRole: 'admin' },
      { icon: LucidePlug, label: 'Conexiones', path: 'conexiones', minRole: 'admin' },
      { icon: LucideFileSearch, label: 'Auditoría', path: 'auditoria', minRole: 'admin' },
      {
        icon: LucideTriangleAlert,
        label: 'Cola de errores',
        path: 'cola-errores',
        minRole: 'admin',
      },
      { icon: LucideWandSparkles, label: 'Asistente', path: 'asistente', minRole: 'admin' },
    ],
  },
];

export function findSection(id: unknown): NavSection | null {
  return SECTIONS.find((section) => section.id === id) ?? null;
}
