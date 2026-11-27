import { formatDateTime } from '../../shared/labels';
import {
  formatDuration,
  fresher,
  isActive,
  KIND_LABELS,
  labelOf,
  STATUS_LABELS,
  toRunView,
} from './run-labels';
import { NEWS_DONE, RECALC_FAILED, SCAN_RUNNING } from './runs.fixtures';

describe('run labels', () => {
  it('names every kind and status in Spanish and keeps an unknown value as is', () => {
    expect(labelOf(KIND_LABELS, 'scan')).toBe('Escaneo de vulnerabilidades');
    expect(labelOf(STATUS_LABELS, 'failed')).toBe('Terminó con error');
    expect(labelOf(KIND_LABELS, 'inventory_sync')).toBe('inventory_sync');
  });

  it('treats queued and running runs as still active', () => {
    expect(isActive('queued')).toBe(true);
    expect(isActive('running')).toBe(true);
    expect(isActive('succeeded')).toBe(false);
    expect(isActive('failed')).toBe(false);
  });

  it('formats a duration in seconds, minutes or hours', () => {
    expect(formatDuration('2026-11-27T08:00:00Z', '2026-11-27T08:00:45Z')).toBe('45 s');
    expect(formatDuration('2026-11-27T08:00:00Z', '2026-11-27T08:03:00Z')).toBe('3 min');
    expect(formatDuration('2026-11-27T08:00:00Z', '2026-11-27T08:03:20Z')).toBe('3 min 20 s');
    expect(formatDuration('2026-11-27T08:00:00Z', '2026-11-27T10:00:00Z')).toBe('2 h');
    expect(formatDuration('2026-11-27T08:00:00Z', '2026-11-27T10:05:00Z')).toBe('2 h 5 min');
  });

  it('gives no duration without an end, with a bad date or with an end before the start', () => {
    expect(formatDuration('2026-11-27T08:00:00Z', null)).toBeNull();
    expect(formatDuration('nope', '2026-11-27T08:00:00Z')).toBeNull();
    expect(formatDuration('2026-11-27T08:00:00Z', '2026-11-27T07:00:00Z')).toBeNull();
  });

  it('shows a finished run with its end, duration, reason and launcher', () => {
    const view = toRunView(NEWS_DONE);
    expect(view).toMatchObject({
      id: NEWS_DONE.id,
      kindLabel: 'Ingesta de noticias',
      status: 'succeeded',
      statusLabel: 'Terminó bien',
      progress: 100,
      active: false,
      started: formatDateTime(NEWS_DONE.started_at),
      finished: formatDateTime(NEWS_DONE.finished_at!),
      duration: '3 min 20 s',
      trigger: 'Agenda',
      launchedBy: '—',
    });
  });

  it('shows a running run as in progress and lets the live progress override the listed one', () => {
    expect(toRunView(SCAN_RUNNING)).toMatchObject({
      finished: 'En curso',
      duration: 'En curso',
      trigger: 'Manual',
      launchedBy: 'Ana Admin',
    });
    const live = toRunView(SCAN_RUNNING, { progress: 72.4, status: null });
    expect(live.progress).toBe(72);
    expect(live.status).toBe('running');
    const done = toRunView(SCAN_RUNNING, { progress: 140, status: 'succeeded' });
    // Once the API lists the run as ended, its row wins over the last event.
    expect(toRunView(NEWS_DONE, { progress: 40, status: 'running' })).toMatchObject({
      progress: 100,
      status: 'succeeded',
    });
    expect(done).toMatchObject({
      progress: 100,
      status: 'succeeded',
      active: false,
      finished: '—',
    });
  });

  it('shows a dash for a missing reason', () => {
    expect(toRunView({ ...RECALC_FAILED, trigger_reason: null }).trigger).toBe('—');
  });

  it('keeps the copy of a run that already ended', () => {
    expect(fresher(undefined, SCAN_RUNNING)).toBe(SCAN_RUNNING);
    expect(fresher(NEWS_DONE, SCAN_RUNNING)).toBe(NEWS_DONE);
    const ended = { ...SCAN_RUNNING, status: 'succeeded' as const };
    expect(fresher(SCAN_RUNNING, ended)).toBe(ended);
    expect(fresher(ended, SCAN_RUNNING)).toBe(ended);
  });
});
