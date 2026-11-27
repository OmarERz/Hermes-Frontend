import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import type { ConnectionName, ConnectionStatus } from './connection-labels';

/**
 * Connections (docs/13 §9 paso 1, FRONTEND.md §3), admin only: `GET /api/connections/status` returns the last check
 * of each external service (reused for 5 minutes, so it spends no quota) and `POST /api/connections/test` checks
 * again the ones asked for, or all of them. Both only verify: keys are configured on the server, never here.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionsService {
  private readonly api = inject(ApiClient);

  status(): Observable<ConnectionStatus[]> {
    return this.api.get('/api/connections/status');
  }

  /** Checks the given connections again; `null` checks all of them. */
  test(names: ConnectionName[] | null): Observable<ConnectionStatus[]> {
    return this.api.post('/api/connections/test', { body: { names } });
  }
}
