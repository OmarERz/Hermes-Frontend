import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient, ApiSchema } from '../../core/api/api-client';
import type { Role } from '../../core/api/api-types';
import type { CursorPage } from '../../shared/cursor-pager';

export type UserAccount = ApiSchema<'UserAccount'>;
export type RoleAssigned = ApiSchema<'RoleAssigned'>;

/** Users and roles (admin): the Firebase accounts with their roles and the role assignment (D-030). */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiClient);

  /** One page of accounts, by e-mail, whether they signed in or not. */
  list(cursor: string | null, limit: number): Observable<CursorPage<UserAccount>> {
    return this.api
      .get('/api/admin/users', { query: { cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }

  /**
   * Assigns a role (the Firebase claim and the stored copy) and revokes the user's sessions. `expectedRole` is the
   * stored role the admin read: a 409 `role_changed` means it changed in between (API-03).
   */
  assignRole(uid: string, role: Role, expectedRole: Role | null): Observable<RoleAssigned> {
    return this.api.put('/api/admin/users/{uid}/role', {
      path: { uid },
      body: { role, expected_role: expectedRole },
    });
  }
}
