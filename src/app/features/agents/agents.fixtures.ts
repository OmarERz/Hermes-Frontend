import type { ApiSchema } from '../../core/api/api-client';

/** Test data shaped like the F18.1 responses (role reader), for the specs of the home and agents screens. */

export const AGENT_JUDGE: ApiSchema<'AgentTelemetry'> = {
  agent: 'judge',
  reviews: 12,
  by_status: { applied: 9, no_judge_review: 2, rejected: 1 },
  success_percent: '91.7',
  latency_avg_ms: 2400,
  latency_p95_ms: 5100,
  tokens_input: 48210,
  tokens_output: 6120,
  cost_usd: '0.084210',
  provider: 'claude-code',
  model: 'opus',
  last_model: 'deepseek-v4-pro',
  spend_today_usd: '0.021000',
  active: true,
  ladder_level: 0,
};

export const AGENT_NEWS: ApiSchema<'AgentTelemetry'> = {
  agent: 'news_analyst',
  reviews: 30,
  by_status: { applied: 30 },
  success_percent: '100.0',
  latency_avg_ms: 850,
  latency_p95_ms: 1300,
  tokens_input: 90000,
  tokens_output: 12000,
  cost_usd: '0.030000',
  provider: 'claude-code',
  model: 'sonnet',
  last_model: null,
  spend_today_usd: '0.004000',
  active: true,
  ladder_level: null,
};

export const AGENT_CVE: ApiSchema<'AgentTelemetry'> = {
  agent: 'cve_analyst',
  reviews: 0,
  by_status: {},
  success_percent: null,
  latency_avg_ms: null,
  latency_p95_ms: null,
  tokens_input: 0,
  tokens_output: 0,
  cost_usd: '0.000000',
  provider: 'claude-code',
  model: 'sonnet',
  last_model: null,
  spend_today_usd: '0.000000',
  active: false,
  ladder_level: null,
};

export const TELEMETRY_SUMMARY: ApiSchema<'TelemetrySummary'> = {
  window: '24h',
  since: '2026-11-26T08:00:00Z',
  generated_at: '2026-11-27T08:00:00Z',
  runs: [
    { kind: 'scan', queued: 0, running: 1, succeeded: 3, failed: 1 },
    { kind: 'ingestion', queued: 1, running: 0, succeeded: 5, failed: 0 },
  ],
  runs_queued: 1,
  runs_running: 1,
  runs_succeeded: 8,
  runs_failed: 1,
  run_success_percent: '88.9',
  // Out of the screen order on purpose: the screen sorts them (judge, news, CVE).
  agents: [AGENT_CVE, AGENT_NEWS, AGENT_JUDGE],
  top_reasons: [
    { code: 'mass_exploitation', label: 'Explotación masiva', accepted: 4, rejected: 1 },
    { code: 'exposed_asset', label: 'Activo expuesto', accepted: 2, rejected: 0 },
  ],
  daily_budget_usd: '5.00',
  spend_today_usd: '0.025000',
  ladder_level: 0,
  ladder_label: 'Normal',
};

export const TELEMETRY_DAILY: ApiSchema<'TelemetryDaily'> = {
  days: 2,
  series: [
    {
      date: '2026-11-26',
      runs_succeeded: 4,
      runs_failed: 1,
      agents: [
        {
          agent: 'judge',
          reviews: 5,
          success_percent: '80.0',
          latency_avg_ms: 2000,
          cost_usd: '0.040000',
        },
        {
          agent: 'news_analyst',
          reviews: 10,
          success_percent: '100.0',
          latency_avg_ms: 900,
          cost_usd: '0.010000',
        },
      ],
    },
    {
      date: '2026-11-27',
      runs_succeeded: 3,
      runs_failed: 0,
      agents: [
        {
          agent: 'judge',
          reviews: 0,
          success_percent: null,
          latency_avg_ms: null,
          cost_usd: '0.000000',
        },
      ],
    },
  ],
};

export const TICKET_SUMMARY: ApiSchema<'TicketSummary'> = {
  total: 14,
  by_status: { pending_creation: 2, open: 7, resolved: 3, closed: 2 },
  by_urgency: { '1': 3, '2': 5, '3': 3, '4': 1 },
  changed_by_person: 2,
  resolved: 5,
  resolved_percent: '41.7',
  avg_resolution_hours: '30.5',
};

export const INVENTORY_SUMMARY: ApiSchema<'InventorySummary'> = {
  total_assets: 28,
  by_class: { Server: 10, VirtualMachine: 8 },
  by_criticality: { high: 5 },
  by_exposure: { exposed: 6, internal: 20, unknown: 2 },
  by_classification: { classified: 12 },
  owners: 6,
  without_owner: 1,
  custodians: 6,
  with_open_findings: 9,
  with_kev_findings: 2,
  last_sync_at: '2026-11-27T07:30:00Z',
  software: {
    total: 32,
    with_cpe: 28,
    with_known_version: 30,
    without_critical: 25,
    cpe_percent: '87.5',
    known_version_percent: '93.8',
    without_critical_percent: '78.1',
  },
};

export const LATEST_RUN: ApiSchema<'Run'> = {
  id: '0196a6f0-0000-7000-8000-0000000000aa',
  kind: 'scan',
  status: 'succeeded',
  started_at: '2026-11-27T07:00:00Z',
  finished_at: '2026-11-27T07:02:05Z',
  progress: 100,
  trigger_reason: 'manual',
  triggered_by: 'Ana Analista',
};

export const ASSESSMENT_ID = '0196a6f0-0000-7000-8000-000000000001';

export const LLM_REVIEW: ApiSchema<'LlmReviewEntry'> = {
  id: '0196a6f0-0000-7000-8000-0000000000b1',
  created_at: '2026-11-27T07:01:00Z',
  agent: 'judge',
  mode: 'scoring',
  model: 'opus',
  status: 'applied',
  attempts: 2,
  latency_ms: 2400,
  tokens_input: 4100,
  tokens_cached: 1000,
  tokens_output: 520,
  tokens_reasoning: 80,
  cost_usd: '0.007100',
  ladder_level: 0,
  second_review: false,
  assessment_id: ASSESSMENT_ID,
  reasons_accepted: 2,
  reasons_rejected: 1,
};

export const HISTORY_RUN: ApiSchema<'HistoryEvent'> = {
  id: '0196a6f0-0000-7000-8000-0000000000c1',
  type: 'run',
  at: '2026-11-27T07:00:00Z',
  title: 'Escaneo simulado',
  status: 'succeeded',
  actor: 'Ana Analista',
  trigger: 'manual',
  run_kind: 'scan',
  agent: null,
  assessment_id: null,
  config_version: null,
  duration_seconds: 125,
};

export const HISTORY_REVIEW: ApiSchema<'HistoryEvent'> = {
  id: '0196a6f0-0000-7000-8000-0000000000c2',
  type: 'llm_review',
  at: '2026-11-27T07:01:00Z',
  title: 'Revisión del juez',
  status: 'applied',
  actor: 'Juez',
  trigger: null,
  run_kind: null,
  agent: 'judge',
  assessment_id: ASSESSMENT_ID,
  config_version: null,
  duration_seconds: 2,
};

export const HISTORY_CONFIG: ApiSchema<'HistoryEvent'> = {
  id: '0196a6f0-0000-7000-8000-0000000000c3',
  type: 'config_change',
  at: '2026-11-26T18:00:00Z',
  title: 'Sensibilidad del juez: normal → amplia',
  status: 'applied',
  actor: 'Admin Hermes',
  trigger: null,
  run_kind: null,
  agent: null,
  assessment_id: null,
  config_version: 7,
  duration_seconds: null,
};

export const JUDGE_DETAIL: ApiSchema<'JudgeDetail'> = {
  assessment_id: ASSESSMENT_ID,
  review_id: LLM_REVIEW.id,
  status: 'applied',
  summary: 'Explotación masiva confirmada en dos fuentes.',
  model: 'opus',
  reviewed_at: '2026-11-27T07:01:00Z',
  proposed_adjustment: 8,
  applied_adjustment: 8,
  dead_zone_applied: false,
  accepted_reasons: [
    {
      seq: 1,
      code: 'mass_exploitation',
      label: 'Explotación masiva',
      points: 6,
      quote: '<b>exploited in the wild</b>',
      element_id: 'news-1',
      ci_id: null,
      status: 'accepted',
      rejection_rule: null,
    },
    {
      seq: 2,
      code: 'more_critical_asset',
      label: 'Activo más crítico',
      points: 2,
      quote: 'payments gateway',
      element_id: 'SRV-01',
      ci_id: 'SRV-01',
      status: 'accepted',
      rejection_rule: null,
    },
  ],
  rejected_reasons: [
    {
      seq: 3,
      code: 'ransomware',
      label: 'Ransomware',
      points: 5,
      quote: 'ransomware gang',
      element_id: 'news-2',
      ci_id: null,
      status: 'rejected',
      rejection_rule: 'L5.quote',
    },
  ],
  double_review: {
    agreed: true,
    first_adjustment: 8,
    second_adjustment: 7,
    second_status: 'applied',
  },
  mitigation_status: 'accepted',
};

export const FEEDBACK_ENTRY: ApiSchema<'FeedbackEntry'> = {
  active: true,
  channel: 'frontend',
  comment: null,
  created_at: '2026-11-27T07:10:00Z',
  on_older_version: false,
  proposed_level: null,
  proposed_score: null,
  user: 'Ana Analista',
  verdict: 'relevant',
};

export const TICKET_UPDATE: ApiSchema<'TicketUpdateEntry'> = {
  id: '0196a6f0-0000-7000-8000-0000000000d1',
  created_at: '2026-11-27T07:05:00Z',
  action: 'create',
  label: 'Ticket creado',
  assessment_id: ASSESSMENT_ID,
  ticket_itop_id: '123',
  ticket_ref: 'R-000123',
  ticket_url: 'https://itop.test/pages/UI.php?operation=details&class=UserRequest&id=123',
  cve: 'CVE-2026-10001',
  custodian: 'Infraestructura Linux',
  itop_status: 'done',
};

export const METRICS: ApiSchema<'MetricsDashboard'> = {
  generated_at: '2026-11-27T08:00:00Z',
  metrics: [
    { key: 'precision', label: 'Precisión', value: '82.5', unit: '%' },
    { key: 'cost_usd', label: 'Costo de LLM del día', value: '0.42', unit: 'USD' },
    { key: 'retries', label: 'Reintentos de LLM', value: '3', unit: null },
    { key: 'error_queue_size', label: 'Cola de error', value: '2', unit: null },
    { key: 'notification_failed', label: 'Eventos en error', value: '0', unit: null },
    { key: 'brand_new_metric', label: 'Métrica nueva', value: '1.5', unit: 'h' },
    {
      key: 'judge_ladder_level',
      label: 'Nivel de la escalera del juez',
      value: '0 · Normal',
      unit: null,
    },
  ],
};
