import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient, ApiSchema } from '../../core/api/api-client';
import type { SetupStep, SetupStepUpdate } from './setup-steps';

export type InventoryPending = ApiSchema<'InventoryPending'>;
export type Run = ApiSchema<'Run'>;

/**
 * Calls of the first-run setup wizard (docs/13 §9, D-042), admin only: the seven steps and their marks
 * (`GET /api/setup/status`, `PUT /api/setup/steps/{n}`), plus what some steps show: the inventory pendings and the
 * simulated scans (their live progress comes from the run events of Corridas). The connections, the company and the
 * sources use the services of their own screens. Nothing here sends or receives a key (SEG-23).
 */
@Injectable({ providedIn: 'root' })
export class SetupService {
  private readonly api = inject(ApiClient);

  status(): Observable<SetupStep[]> {
    return this.api.get('/api/setup/status');
  }

  /** Marks step `n` done or skipped (skipping wins), or takes the mark back; the API audits it. */
  mark(n: number, update: SetupStepUpdate): Observable<SetupStep> {
    return this.api.put('/api/setup/steps/{n}', { path: { n }, body: update });
  }

  pendingInventory(): Observable<InventoryPending> {
    return this.api.get('/api/pending/inventory');
  }

  /** Queues a simulated scan; the worker takes it in seconds. */
  launchScan(): Observable<Run> {
    return this.api.post('/api/scans', { body: { kind: 'scan' } });
  }

  /** The latest scans: the ones not started yet first, then the newest (ARQ-04). */
  scans(limit: number): Observable<Run[]> {
    return this.api
      .get('/api/runs', { query: { kind: 'scan', limit } })
      .pipe(map((page) => page.items));
  }

  /** One run by its id, with its current status (the final one once it ended). */
  run(id: string): Observable<Run> {
    return this.api.get('/api/runs/{id}', { path: { id } });
  }
}
