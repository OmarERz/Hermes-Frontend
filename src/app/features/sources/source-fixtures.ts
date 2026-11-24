import type { Source } from './source-labels';

/** A source as `GET /api/sources` returns it, for the specs of this folder. */
export function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: '0b6c1f8e-1d2a-4c3b-9e8f-7a6b5c4d3e2f',
    name: 'CISA KEV',
    type: 'official',
    level: 'N1',
    structural: true,
    active: true,
    last_capture: '2026-11-23T06:00:00Z',
    items_per_run: 12,
    health: 'ok',
    ...overrides,
  };
}
