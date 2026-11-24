import type { FeedbackEntry, LevelBands, Recommendation } from './feedback';

/** Test data of the Recomendaciones screen (only the specs import it), shaped like the OpenAPI examples. */

export const BANDS: LevelBands = { critical: 90, high: 75, medium: 50, low: 0 };

export const RECOMMENDATION: Recommendation = {
  assessment_id: '0192f3a4-7b1e-7c2d-8a5f-3e4d5c6b7a89',
  created_at: '2026-11-23T10:35:00Z',
  cve: 'CVE-2026-10001',
  product: 'OpenSSL 3.0.7',
  base: 74,
  judge_adjustment: 12,
  final: 86,
  level: 'high',
  previous_final: 70,
  justification: 'Explotación activa en un servidor expuesto, impulsada por srv-pagos-01.',
  mitigation: 'Actualizar OpenSSL a la versión 3.0.8 o superior.',
  mitigation_draft: ['Aislar el servidor de la red pública.', 'Aplicar el parche del fabricante.'],
  asset: {
    ci_id: '12',
    name: 'srv-pagos-01',
    itop_url: 'https://itop.example.test/pages/UI.php?operation=details&class=Server&id=12',
    owner: 'Ana López',
    custodian: 'Infraestructura Linux',
    criticality: 'high',
    exposed: true,
    classification: 'classified',
    classification_at_evaluation: 'classified',
    finding_status: 'new',
    finding_id: null,
    score: 86,
  },
  ticket_url: 'https://itop.example.test/pages/UI.php?operation=details&class=UserRequest&id=1234',
  feedback_count: 0,
};

export function recommendation(changes: Partial<Recommendation> = {}): Recommendation {
  return { ...RECOMMENDATION, ...changes };
}

export const FEEDBACK_ENTRY: FeedbackEntry = {
  user: 'Ana López',
  channel: 'frontend',
  verdict: 'wrong_priority',
  proposed_level: 'critical',
  proposed_score: 92,
  comment: 'El servidor procesa pagos.',
  created_at: '2026-11-23T11:00:00Z',
  active: true,
  on_older_version: false,
};
