import {
  LucideBot,
  LucideHouse,
  LucideIconInput,
  LucideMonitor,
  LucideServerCog,
  LucideShieldAlert,
  LucideSlidersHorizontal,
} from '@lucide/angular';
import type { Role } from '../api/api-types';
import type { SectionId } from './route-data';

export { SECTION, type SectionId } from './route-data';

export interface NavTab {
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
    tabs: [{ label: 'Inicio', path: 'inicio', minRole: 'reader' }],
  },
  {
    id: 'agents',
    label: 'Agentes',
    icon: LucideBot,
    tabs: [
      { label: 'Panel', path: 'agentes', minRole: 'reader' },
      { label: 'Historial', path: 'historial-agente', minRole: 'reader' },
      { label: 'Recomendaciones', path: 'recomendaciones-agente', minRole: 'reader' },
      { label: 'Métricas', path: 'metricas', minRole: 'reader' },
    ],
  },
  {
    id: 'vulnerabilities',
    label: 'Vulnerabilidades',
    icon: LucideShieldAlert,
    tabs: [
      { label: 'Por grupo', path: 'vulnerabilidades', minRole: 'reader' },
      { label: 'Comparación', path: 'comparacion', minRole: 'reader' },
      { label: 'Tickets y alertas', path: 'tickets', minRole: 'reader' },
      { label: 'Exportación STIX', path: 'exportacion-stix', minRole: 'analyst' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventario',
    icon: LucideMonitor,
    tabs: [
      { label: 'Activos', path: 'activos', minRole: 'reader' },
      { label: 'Software', path: 'software', minRole: 'reader' },
      { label: 'Pendientes', path: 'pendientes-inventario', minRole: 'reader' },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuración',
    icon: LucideSlidersHorizontal,
    tabs: [
      { label: 'Juez', path: 'configuracion-agente', minRole: 'reader' },
      { label: 'Fórmula', path: 'formula', minRole: 'reader' },
      { label: 'Parámetros', path: 'parametros', minRole: 'reader' },
      { label: 'Calibración', path: 'calibracion', minRole: 'reader' },
      { label: 'Fuentes', path: 'fuentes', minRole: 'reader' },
      { label: 'Empresa', path: 'empresa', minRole: 'reader' },
    ],
  },
  {
    id: 'operations',
    label: 'Operación',
    icon: LucideServerCog,
    tabs: [
      { label: 'Corridas', path: 'corridas', minRole: 'reader' },
      { label: 'Usuarios', path: 'usuarios', minRole: 'admin' },
      { label: 'Conexiones', path: 'conexiones', minRole: 'admin' },
      { label: 'Auditoría', path: 'auditoria', minRole: 'admin' },
      { label: 'Cola de errores', path: 'cola-errores', minRole: 'admin' },
      { label: 'Asistente', path: 'asistente', minRole: 'admin' },
    ],
  },
];

export function findSection(id: unknown): NavSection | null {
  return SECTIONS.find((section) => section.id === id) ?? null;
}
