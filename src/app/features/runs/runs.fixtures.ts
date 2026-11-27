import type { TelemetrySummary } from './runs.service';
import type { Run } from './run-labels';

/** Runs and counts shaped like the API answers, for this area's specs. */
export const SCAN_RUNNING: Run = {
  id: '0196a6f0-0000-7000-8000-000000000001',
  kind: 'scan',
  status: 'running',
  progress: 40,
  started_at: '2026-11-27T09:00:00Z',
  finished_at: null,
  trigger_reason: 'manual',
  triggered_by: 'Ana Admin',
};

export const NEWS_DONE: Run = {
  id: '0196a6f0-0000-7000-8000-000000000002',
  kind: 'ingestion',
  status: 'succeeded',
  progress: 100,
  started_at: '2026-11-27T08:00:00Z',
  finished_at: '2026-11-27T08:03:20Z',
  trigger_reason: 'schedule',
  triggered_by: null,
};

export const RECALC_FAILED: Run = {
  id: '0196a6f0-0000-7000-8000-000000000003',
  kind: 'recalculation',
  status: 'failed',
  progress: 60,
  started_at: '2026-11-26T22:00:00Z',
  finished_at: '2026-11-26T22:00:45Z',
  trigger_reason: 'formula_change',
  triggered_by: 'Ana Admin',
};

export const SUMMARY: TelemetrySummary = {
  window: '24h',
  since: '2026-11-26T09:00:00Z',
  generated_at: '2026-11-27T09:00:00Z',
  runs: [],
  runs_queued: 1,
  runs_running: 2,
  runs_succeeded: 14,
  runs_failed: 3,
  run_success_percent: '82.35',
  agents: [],
  top_reasons: [],
  daily_budget_usd: '5.00',
  spend_today_usd: '0.40',
  ladder_level: 0,
  ladder_label: 'Normal',
};
