import type { ApiSchema } from '../../core/api/api-client';

export type Agent = ApiSchema<'AgentTelemetry'>['agent'];
export type TelemetryWindow = ApiSchema<'TelemetrySummary'>['window'];
export type RunKind = ApiSchema<'RunCounts'>['kind'];
export type ReviewStatus = ApiSchema<'LlmReviewEntry'>['status'];
export type HistoryType = ApiSchema<'HistoryEvent'>['type'];
export type RunTrigger = NonNullable<ApiSchema<'HistoryEvent'>['trigger']>;
export type Provider = ApiSchema<'AgentTelemetry'>['provider'];
export type TicketAction = ApiSchema<'TicketUpdateEntry'>['action'];
export type ItopWriteStatus = NonNullable<ApiSchema<'TicketUpdateEntry'>['itop_status']>;
export type ReasonStatus = ApiSchema<'JudgeReasonItem'>['status'];
export type MitigationStatus = NonNullable<ApiSchema<'JudgeDetail'>['mitigation_status']>;

/** Order of the agents on every screen: the judge first, then the two analysts. */
export const AGENTS: readonly Agent[] = ['judge', 'news_analyst', 'cve_analyst'];

/** Spanish names of the backend enums (from their OpenAPI descriptions). */
export const AGENT_LABELS: Record<Agent, string> = {
  judge: 'Juez',
  news_analyst: 'Analista de noticias',
  cve_analyst: 'Analista de CVE',
};

/** What each agent does (docs/05 §2 and §3, docs/07): static text, never data. */
export const AGENT_DESCRIPTIONS: Record<Agent, string> = {
  judge:
    'Revisa cada evaluación y propone ajustes con motivos citados; nunca ejecuta acciones por su cuenta.',
  news_analyst:
    'Extrae de cada noticia nueva los CVE, actores, víctimas y el grado de explotación, cada dato con su cita.',
  cve_analyst:
    'Infiere el vector CVSS cuando falta y extrae las condiciones y los componentes de cada CVE.',
};

export const WINDOWS: readonly TelemetryWindow[] = ['24h', '7d', '30d'];

export const WINDOW_LABELS: Record<TelemetryWindow, string> = {
  '24h': 'Últimas 24 horas',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  deepseek: 'DeepSeek',
  'claude-code': 'Claude (Claude Code)',
};

export const RUN_KIND_LABELS: Record<RunKind, string> = {
  scan: 'Escaneo simulado',
  ingestion: 'Ingesta de noticias',
  recalculation: 'Recálculo por fórmula',
  nightly: 'Recálculo nocturno',
  inventory_sync: 'Sincronización del inventario',
  calibration: 'Calibración semanal',
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  queued: 'En cola',
  running: 'En ejecución',
  succeeded: 'Terminó bien',
  failed: 'Terminó con error',
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  applied: 'Aplicada',
  suggestion: 'Solo sugerencia',
  partial_review: 'Revisión parcial',
  judge_disagreement: 'Desacuerdo en la doble revisión',
  no_judge_review: 'Sin juez (respaldo)',
  rejected: 'Rechazada por la validación',
  queued: 'En cola',
};

export const REVIEW_STATUSES = Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[];

/** `llm_review.mode` of the judge (docs/07): mode 1 scores, mode 2 reviews dismissed news. */
export const REVIEW_MODE_LABELS: Record<string, string> = {
  scoring: 'Puntuación (modo 1)',
  dismissals: 'Descartes (modo 2)',
};

export const HISTORY_TYPE_LABELS: Record<HistoryType, string> = {
  run: 'Corrida',
  llm_review: 'Revisión de IA',
  config_change: 'Cambio de configuración',
};

export const HISTORY_TYPES = Object.keys(HISTORY_TYPE_LABELS) as HistoryType[];

export const TRIGGER_LABELS: Record<RunTrigger, string> = {
  schedule: 'Por la agenda',
  manual: 'Lanzada por una persona',
  after_scan: 'Después de un escaneo',
  formula_change: 'Por un cambio de fórmula',
};

export const TICKET_ACTION_LABELS: Record<TicketAction, string> = {
  create: 'Ticket creado',
  add_ci: 'CI agregado',
  add_owner: 'Dueño agregado',
  comment: 'Comentario',
  raise_urgency: 'Urgencia subida',
  lower_urgency: 'Urgencia bajada',
  suggest: 'Sugerencia de urgencia',
  partial_fix: 'Corrección parcial',
  fix_comment: 'Corrección verificada',
  reopen: 'Reabierto',
};

export const TICKET_ACTIONS = Object.keys(TICKET_ACTION_LABELS) as TicketAction[];

export const ITOP_WRITE_LABELS: Record<ItopWriteStatus, string> = {
  pending: 'Espera su envío',
  in_progress: 'Enviándose',
  done: 'Escrito en iTop',
  failed: 'Falló (cola de error)',
};

export const REASON_STATUS_LABELS: Record<ReasonStatus, string> = {
  accepted: 'Aceptado',
  rejected: 'Rechazado por una regla',
  withdrawn: 'Retirado por el juez',
};

export const MITIGATION_LABELS: Record<MitigationStatus, string> = {
  accepted: 'Aceptada (redactada por IA)',
  discarded: 'Descartada por una regla',
  absent: 'El juez no la redactó',
};

/** Status options of the history filter: the final state of a run, of a review or of a change. */
export const HISTORY_STATUS_OPTIONS: Record<HistoryType, readonly string[]> = {
  run: ['queued', 'running', 'succeeded', 'failed'],
  llm_review: REVIEW_STATUSES,
  config_change: ['applied'],
};

/**
 * Spanish name of a history status. `applied` and `queued` mean different things for a review and for a change or a
 * run, so the event type decides; an unknown value is shown as the backend sent it.
 */
export function historyStatusLabel(type: HistoryType | null, status: string): string {
  if (type === 'config_change' && status === 'applied') return 'Aplicado';
  if (type === 'run' || (type === null && status in RUN_STATUS_LABELS)) {
    return RUN_STATUS_LABELS[status] ?? status;
  }
  return REVIEW_STATUS_LABELS[status as ReviewStatus] ?? RUN_STATUS_LABELS[status] ?? status;
}

/** Lookup that falls back to the raw value, for enums the backend may extend. */
export function labelOf<K extends string>(labels: Record<K, string>, value: string | null): string {
  if (value === null || value === '') return '—';
  return (labels as Record<string, string>)[value] ?? value;
}
