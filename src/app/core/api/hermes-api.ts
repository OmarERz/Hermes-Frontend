import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { CurrentUser, ListVulnerabilitiesQuery, VulnerabilityList } from './api-types';

export { toHttpParams } from './api-client';

/**
 * Named calls used by the core (session) and the pilot. New screens call `ApiClient` with the route path
 * directly, in their own feature folder, instead of adding methods here.
 */
@Injectable({ providedIn: 'root' })
export class HermesApi {
  private readonly client = inject(ApiClient);

  /** `get_current_user`: the signed-in user and the effective role (FRONTEND.md §2). */
  getCurrentUser(): Observable<CurrentUser> {
    return this.client.get('/api/me');
  }

  /** `list_vulnerabilities`: grouped view (vulnerability, criticality or asset), paginated by cursor. */
  listVulnerabilities(query: ListVulnerabilitiesQuery = {}): Observable<VulnerabilityList> {
    return this.client.get('/api/vulnerabilities', { query });
  }
}
