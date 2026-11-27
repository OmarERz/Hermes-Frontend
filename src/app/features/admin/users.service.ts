import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient, ApiSchema } from '../../core/api/api-client';
import type { Role } from '../../core/api/api-types';
import type { CursorPage } from '../../shared/cursor-pager';

export type UserAccount = ApiSchema<'UserAccount'>;
export type RoleAssigned = ApiSchema<'RoleAssigned'>;
export type UserCreated = ApiSchema<'UserCreated'>;
export type PasswordEmailSent = ApiSchema<'PasswordEmailSent'>;
export type StatusChanged = ApiSchema<'StatusChanged'>;

/**
 * Users and roles (admin): the Firebase accounts with their roles, the role assignment (D-030), and the accounts an
 * admin creates and switches off or on from the app (D-105). Hermes never sees a password: Firebase e-mails the person
 * a link to choose one.
 */
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

  /**
   * Creates an account without a password; Firebase e-mails the person a link to choose one. `password_email_sent`
   * false means the account exists but the e-mail did not go out (send it again with `sendPasswordEmail`).
   */
  create(email: string, role: Role): Observable<UserCreated> {
    return this.api.post('/api/admin/users', { body: { email, role } });
  }

  /** Has Firebase send the e-mail to choose a password again (its link lasts one hour). */
  sendPasswordEmail(uid: string): Observable<PasswordEmailSent> {
    return this.api.post('/api/admin/users/{uid}/password-email', { path: { uid } });
  }

  /** Switches an account off (its sessions are revoked) or back on, in Firebase and in Hermes. */
  setStatus(uid: string, disabled: boolean): Observable<StatusChanged> {
    return this.api.put('/api/admin/users/{uid}/status', { path: { uid }, body: { disabled } });
  }
}
