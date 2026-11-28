import {
  LucideBuilding2,
  LucideClipboardList,
  LucideIconInput,
  LucidePlay,
  LucidePlug,
  LucideRss,
  LucideSlidersHorizontal,
  LucideUsers,
  LucideWandSparkles,
} from '@lucide/angular';
import type { ApiBody, ApiSchema } from '../../core/api/api-client';

export type SetupStep = ApiSchema<'SetupStep'>;
export type SetupStepUpdate = ApiBody<'/api/setup/steps/{n}', 'put'>;
export type StepState = 'done' | 'skipped' | 'pending';

/**
 * What an admin does with a step: mark it done, skip it, or take back a skip or a manual done mark (`{done: false}`
 * only undoes a mark: a step the data shows stays done).
 */
export type StepMark = 'done' | 'skipped' | 'reset';

export const MARK_BODIES: Record<StepMark, SetupStepUpdate> = {
  done: { done: true, skipped: false },
  skipped: { done: false, skipped: true },
  reset: { done: false, skipped: false },
};

export const STATE_LABELS: Record<StepState, string> = {
  done: 'Hecho',
  skipped: 'Omitido',
  pending: 'Pendiente',
};

export type DoneSource = NonNullable<SetupStep['done_source']>;

/** Where a done step comes from (`done_source`, F18.6): the data shows it, or only an admin's mark. */
export const DONE_SOURCE_LABELS: Record<DoneSource, string> = {
  data: 'detectado',
  manual: 'marcado',
};

/** The state for people, with where a done step comes from when the API says it: «Hecho · detectado». */
export function stateText(step: Pick<SetupStep, 'done' | 'skipped' | 'done_source'>): string {
  const state = stepState(step);
  const source = state === 'done' && step.done_source ? DONE_SOURCE_LABELS[step.done_source] : null;
  return source ? `${STATE_LABELS[state]} · ${source}` : STATE_LABELS[state];
}

/** Only a done mark that nothing else backs can be taken back (with data behind it, it would stay done). */
export function canUnmark(step: Pick<SetupStep, 'done' | 'done_source'>): boolean {
  return step.done && step.done_source === 'manual';
}

export interface StepLink {
  path: string;
  label: string;
}

/** What a step does and what happens if it is skipped (docs/13 §9), for people. */
export interface StepGuide {
  what: string;
  ifSkipped: string;
  links: StepLink[];
  icon: LucideIconInput;
}

/** The seven steps of docs/13 §9, by number (the API names them in the output language). */
export const STEP_GUIDES: Readonly<Record<number, StepGuide>> = {
  1: {
    what: 'Comprueba que Hermes llega a iTop, DeepSeek, NVD, abuse.ch, ransomware.live y Firebase, con su latencia y la variable que falte. Aquí no se captura ninguna llave.',
    ifSkipped:
      'Lo marcado «Sin configurar» o «Con falla» no funciona hasta que se configure en el servidor.',
    links: [{ path: '/conexiones', label: 'Ver el detalle en Conexiones' }],
    icon: LucidePlug,
  },
  2: {
    what: 'Sector principal, subsectores, países de operación e idioma de salida de la empresa.',
    ifSkipped:
      'Hermes no puede medir qué tanto se parece una amenaza a tu empresa (no se calculan R3 ni T).',
    links: [{ path: '/empresa', label: 'Abrir Empresa' }],
    icon: LucideBuilding2,
  },
  3: {
    what: 'Empresas parecidas a la tuya: nombre, alias, dominio, sector y país.',
    ifSkipped: 'La similitud con las víctimas (R3) solo usa el sector.',
    links: [{ path: '/empresa', label: 'Abrir Empresa' }],
    icon: LucideUsers,
  },
  4: {
    what: 'Activa o desactiva las fuentes opcionales de noticias e indicadores. Las estructurales (🔒) siempre están activas.',
    ifSkipped: 'Se usan las fuentes de fábrica.',
    links: [{ path: '/fuentes', label: 'Niveles y feeds propios en Fuentes' }],
    icon: LucideRss,
  },
  5: {
    what: 'Hermes lee el inventario de iTop y muestra lo que le falta: software sin CPE y activos sin clasificación, exposición, responsable o custodio.',
    ifSkipped: 'Quedan como pendientes en la pantalla de Pendientes de inventario.',
    links: [{ path: '/pendientes-inventario', label: 'Abrir Pendientes de inventario' }],
    icon: LucideClipboardList,
  },
  6: {
    what: 'Elige el perfil de sensibilidad del juez, con simulación previa; los pesos de fábrica de la fórmula sirven para empezar.',
    ifSkipped: 'Se usa el perfil «Normal» con los pesos de fábrica.',
    links: [
      { path: '/configuracion-agente', label: 'Modo avanzado en Configuración del juez' },
      { path: '/formula', label: 'Cambiar los pesos en Fórmula' },
    ],
    icon: LucideSlidersHorizontal,
  },
  7: {
    what: 'Lanza el escaneo simulado sobre el inventario y muestra su avance.',
    ifSkipped: 'El escaneo corre en el horario programado.',
    links: [{ path: '/corridas', label: 'Ver en Corridas' }],
    icon: LucidePlay,
  },
};

/** A step the front does not know yet (added to the API later) still shows, with its name only. */
const UNKNOWN_GUIDE: StepGuide = {
  what: 'Este paso todavía no tiene contenido en el asistente: márcalo cuando lo completes.',
  ifSkipped: 'Queda como pendiente.',
  links: [],
  icon: LucideWandSparkles,
};

export function stepGuide(n: number): StepGuide {
  return STEP_GUIDES[n] ?? UNKNOWN_GUIDE;
}

/** Done wins over skipped (the API already resolves it); anything else is pending. */
export function stepState(step: Pick<SetupStep, 'done' | 'skipped'>): StepState {
  if (step.done) return 'done';
  return step.skipped ? 'skipped' : 'pending';
}

/** The step to show first: the first pending one, or the first step when nothing is pending. */
export function firstOpenStep(steps: readonly SetupStep[]): number | null {
  return (steps.find((step) => stepState(step) === 'pending') ?? steps[0])?.n ?? null;
}

/** The next pending step after `n` (wrapping to the start); null when nothing else is pending. */
export function nextOpenStep(steps: readonly SetupStep[], n: number): number | null {
  const open = steps.filter((step) => step.n !== n && stepState(step) === 'pending');
  return (open.find((step) => step.n > n) ?? open[0])?.n ?? null;
}

/** What the page says after a mark. */
export function markNotice(step: SetupStep, mark: StepMark): string {
  if (mark === 'reset') {
    return stepState(step) === 'done'
      ? `«${step.name}» sigue hecho: los datos ya lo muestran.`
      : `«${step.name}» volvió a quedar pendiente.`;
  }
  if (stepState(step) === 'done') return `«${step.name}» quedó como hecho.`;
  return `Se omitió «${step.name}». ${stepGuide(step.n).ifSkipped}`;
}
