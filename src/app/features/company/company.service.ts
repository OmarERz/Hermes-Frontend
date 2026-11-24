import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiBody, ApiClient } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';
import type { CompanyProfile, PeerCompany, PeerCompanyInput } from './company-labels';

export type ProfileUpdate = ApiBody<'/api/profile', 'put'>;

/**
 * Company profile and peer companies (docs/13 §9, FRONTEND.md §3): reading is for every role; writing is admin
 * only. `PUT /api/profile` carries the version the screen read (`expected_version`, 409 `version_conflict`).
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly api = inject(ApiClient);

  getProfile(): Observable<CompanyProfile> {
    return this.api.get('/api/profile');
  }

  updateProfile(update: ProfileUpdate): Observable<CompanyProfile> {
    return this.api.put('/api/profile', { body: update });
  }

  listPeers(cursor: string | null, limit: number): Observable<CursorPage<PeerCompany>> {
    return this.api
      .get('/api/peer-companies', { query: { cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }

  createPeer(peer: PeerCompanyInput): Observable<PeerCompany> {
    return this.api.post('/api/peer-companies', { body: peer });
  }

  updatePeer(id: string, peer: PeerCompanyInput): Observable<PeerCompany> {
    return this.api.put('/api/peer-companies/{id}', { path: { id }, body: peer });
  }

  deletePeer(id: string): Observable<void> {
    return this.api.delete('/api/peer-companies/{id}', { path: { id } });
  }
}
