import {
  LucideBell,
  LucideCoins,
  LucideIconInput,
  LucideScale,
  LucideServerCog,
  LucideShapes,
  LucideTarget,
} from '@lucide/angular';
import type { Metric } from './agents.service';

export interface MetricGroupInfo {
  id: string;
  title: string;
  description: string;
  icon: LucideIconInput;
  keys: readonly string[];
}

/** Sections of the board (docs/10 §1), each with the metric keys of `GET /api/metrics` it shows, in order. */
export const METRIC_GROUPS: readonly MetricGroupInfo[] = [
  {
    id: 'quality',
    title: 'Calidad de las recomendaciones',
    description: 'Lo que dice el feedback y cuánto cambia la prioridad frente al CVSS.',
    icon: LucideTarget,
    keys: [
      'precision',
      'critical_precision',
      'feedback_rate',
      'wrong_priority_judged',
      'original_score_accepted',
      'reclassified',
      'hidden_criticals',
      'noise_avoided',
    ],
  },
  {
    id: 'judge',
    title: 'Juez',
    description: 'Confianza, respaldos, doble revisión y ajustes del juez.',
    icon: LucideScale,
    keys: [
      'judge_ladder_level',
      'fallback_rate',
      'validation_failure_rate',
      'double_review_rate',
      'double_review_disagreement',
      'judge_adjustment_avg',
      'judge_adjustment_up',
      'judge_adjustment_down',
      'judge_adjustment_large',
      'reason_usage',
      'rule_rejections',
    ],
  },
  {
    id: 'llm',
    title: 'Uso de IA y costo',
    description: 'Costo del día, reintentos y validación a la primera de las salidas de la IA.',
    icon: LucideCoins,
    keys: ['cost_usd', 'retries', 'first_pass_validation'],
  },
  {
    id: 'operations',
    title: 'Operación e inventario',
    description: 'Cola de error, salud de las fuentes y del inventario de iTop.',
    icon: LucideServerCog,
    keys: [
      'error_queue_size',
      'error_queue_oldest_hours',
      'source_hours_since_ok',
      'cpe_mapping_coverage',
      'inventory_pending',
    ],
  },
  {
    id: 'notifications',
    title: 'Notificaciones',
    description: 'Eventos de notificación pendientes, en error y su latencia de entrega.',
    icon: LucideBell,
    keys: [
      'notification_pending',
      'notification_failed',
      'immediate_oldest_pending_minutes',
      'delivery_latency_p95_seconds',
    ],
  },
];

/** Section for keys the board does not know yet: they are shown, never dropped. */
export const OTHER_GROUP: Omit<MetricGroupInfo, 'keys'> = {
  id: 'other',
  title: 'Otras métricas',
  description: 'Métricas que el backend agregó después de esta pantalla.',
  icon: LucideShapes,
};

/** What each metric measures (docs/10 §1), for its help button. Static text, never data. */
export const METRIC_HELP: Readonly<Record<string, string>> = {
  precision: 'Relevante sobre Relevante más Falso positivo, en el feedback recibido (MET-01).',
  critical_precision: 'Críticos sin «Prioridad incorrecta» sobre los críticos enviados (MET-03).',
  feedback_rate: 'Mensajes con algún feedback sobre los mensajes enviados (MET-02).',
  wrong_priority_judged: 'Evaluaciones con ajuste del juez que recibieron «Prioridad incorrecta».',
  original_score_accepted:
    'Feedback que pide quedarse con la puntuación original, sin el ajuste del juez.',
  reclassified: 'Hallazgos cuyo nivel final es distinto de su nivel CVSS (MET-24).',
  hidden_criticals: 'Hallazgos con CVSS menor a 7.0 y puntuación final de 75 o más (MET-25).',
  noise_avoided: 'Hallazgos con CVSS de 9.0 o más y puntuación final menor a 50 (MET-26).',
  judge_ladder_level:
    'Confianza en el juez: Normal, Vigilado, Cauteloso o Apagado. Sube de nivel con feedback negativo sobre sus ajustes.',
  fallback_rate: 'Evaluaciones sin juez, con respaldo final = base (MET-14).',
  validation_failure_rate: 'Respuestas del juez que no pasan la validación.',
  double_review_rate: 'Evaluaciones en las que se disparó la doble revisión ciega (MET-11).',
  double_review_disagreement:
    'Dobles revisiones en desacuerdo; sin acuerdo, la final es la base (MET-11).',
  judge_adjustment_avg: 'Ajuste promedio del juez, en puntos (MET-13).',
  judge_adjustment_up: 'Ajustes del juez que suben la puntuación (MET-13).',
  judge_adjustment_down: 'Ajustes del juez que bajan la puntuación (MET-13).',
  judge_adjustment_large: 'Ajustes del juez de 15 puntos o más (MET-13).',
  reason_usage: 'Motivos del juez aceptados en el último día calculado (MET-07).',
  rule_rejections: 'Motivos del juez rechazados por las reglas L5, L6 o L7 (MET-10).',
  cost_usd: 'Costo de IA del último día, con la tabla de precios configurada (MET-17).',
  retries: 'Reintentos de llamadas a la IA del último día (MET-16).',
  first_pass_validation:
    'Salidas de la IA que validan sin reintento; se muestra la pieza con el peor valor (MET-15).',
  error_queue_size: 'Elementos en la cola de error (MET-18).',
  error_queue_oldest_hours: 'Antigüedad del elemento más viejo de la cola de error (MET-18).',
  source_hours_since_ok:
    'Horas desde la última captura correcta de la fuente más atrasada (MET-22).',
  cpe_mapping_coverage: 'Software de iTop con su CPE mapeado (MET-21).',
  inventory_pending: 'CIs sin clasificación, exposición, dueño o custodio (MET-29).',
  notification_pending: 'Eventos de notificación que esperan su entrega (MET-30).',
  notification_failed: 'Eventos de notificación en error (MET-30).',
  immediate_oldest_pending_minutes:
    'Minutos del evento inmediato más antiguo sin entregar (MET-30).',
  delivery_latency_p95_seconds: 'Latencia p95 de entrega de los eventos de notificación (MET-30).',
};

export interface MetricCard {
  key: string;
  label: string;
  value: string;
  help: string | null;
}

export interface MetricGroup extends Omit<MetricGroupInfo, 'keys'> {
  metrics: MetricCard[];
}

/** A metric value with its unit, as the backend formatted it (never recalculated). */
export function metricValue(metric: Metric): string {
  return metric.unit ? `${metric.value} ${metric.unit}` : metric.value;
}

/**
 * The metrics of the board by section, each section in its own order; a key no section knows goes to «Otras
 * métricas». Sections without metrics are left out.
 */
export function groupMetrics(metrics: readonly Metric[]): MetricGroup[] {
  const card = (metric: Metric): MetricCard => ({
    key: metric.key,
    label: metric.label,
    value: metricValue(metric),
    help: METRIC_HELP[metric.key] ?? null,
  });
  const byKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const known = new Set(METRIC_GROUPS.flatMap((group) => group.keys));
  const groups: MetricGroup[] = METRIC_GROUPS.map(({ keys, ...info }) => ({
    ...info,
    metrics: keys.flatMap((key) => {
      const metric = byKey.get(key);
      return metric ? [card(metric)] : [];
    }),
  }));
  groups.push({
    ...OTHER_GROUP,
    metrics: metrics.filter((metric) => !known.has(metric.key)).map(card),
  });
  return groups.filter((group) => group.metrics.length > 0);
}
