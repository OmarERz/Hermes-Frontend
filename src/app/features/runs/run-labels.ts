import { ApiSchema } from '../../core/api/api-client';
import { formatDateTime } from '../../shared/labels';

export type Run = ApiSchema<'Run'>;
export type RunKind = Run['kind'];
export type RunStatus = Run['status'];
export type TriggerReason = NonNullable<Run['trigger_reason']>;

/** Spanish names of the run enums, from the OpenAPI descriptions of `Run`. */
export const KIND_LABELS: Record<RunKind, string> = {
  scan: 'Escaneo de vulnerabilidades',
  ingestion: 'Ingesta de noticias',
  recalculation: 'Recálculo por cambio de fórmula',
  nightly: 'Recálculo nocturno',
};

export const STATUS_LABELS: Record<RunStatus, string> = {
  queued: 'En cola',
  running: 'En ejecución',
  succeeded: 'Terminó bien',
  failed: 'Terminó con error',
};

export const TRIGGER_LABELS: Record<TriggerReason, string> = {
  schedule: 'Agenda',
  manual: 'Manual',
  after_scan: 'Después de un escaneo',
  formula_change: 'Cambio de fórmula',
};

export const RUN_KINDS = Object.keys(KIND_LABELS) as RunKind[];
export const RUN_STATUSES = Object.keys(STATUS_LABELS) as RunStatus[];

/** True while the run can still change: the worker has not taken it or is running it. */
export function isActive(status: RunStatus): boolean {
  return status === 'queued' || status === 'running';
}

/** Of two copies of the same run, the one that already ended (the API never brings an ended run back). */
export function fresher(listed: Run | undefined, kept: Run): Run {
  if (!listed) return kept;
  return isActive(listed.status) && !isActive(kept.status) ? kept : listed;
}

/** The label of a value of an enum, or the value itself when the API sends one the front does not know yet. */
export function labelOf<K extends string>(labels: Record<K, string>, value: string): string {
  return (labels as Record<string, string>)[value] ?? value;
}

/** Elapsed time between two ISO instants, as people read it: «45 s», «3 min 20 s», «2 h 5 min». */
export function formatDuration(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const rest = seconds % 60;
    return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** A run with everything the table and the detail show, already in Spanish. */
export interface RunView {
  run: Run;
  id: string;
  kindLabel: string;
  status: RunStatus;
  statusLabel: string;
  progress: number;
  active: boolean;
  started: string;
  finished: string;
  duration: string;
  trigger: string;
  launchedBy: string;
}

/**
 * The run as shown. While the API still lists it as queued or running, its live progress (from the event stream)
 * goes in place of the listed one; once the API lists it as ended, that final row wins over any last event.
 */
export function toRunView(
  run: Run,
  live?: { progress: number; status: RunStatus | null },
): RunView {
  const stream = live && isActive(run.status) ? live : undefined;
  const status = stream?.status ?? run.status;
  const progress = Math.max(0, Math.min(100, Math.round(stream?.progress ?? run.progress)));
  const active = isActive(status);
  return {
    run,
    id: run.id,
    kindLabel: labelOf(KIND_LABELS, run.kind),
    status,
    statusLabel: labelOf(STATUS_LABELS, status),
    progress,
    active,
    started: formatDateTime(run.started_at),
    finished: run.finished_at ? formatDateTime(run.finished_at) : active ? 'En curso' : '—',
    duration: formatDuration(run.started_at, run.finished_at) ?? (active ? 'En curso' : '—'),
    trigger: run.trigger_reason ? labelOf(TRIGGER_LABELS, run.trigger_reason) : '—',
    launchedBy: run.triggered_by ?? '—',
  };
}
