import { Provider, signal } from '@angular/core';
import type { User } from 'firebase/auth';
import type { CurrentUser, Role } from '../core/api/api-types';
import { roleAtLeast } from '../core/auth/roles';
import { SessionService, SessionStatus } from '../core/auth/session.service';

/**
 * Test double of the session for screen specs: every page banner renders the section tabs, which read the
 * effective role. `provideFakeSession('analyst')` signs in with that role; `null` means no session. Type-checked
 * against SessionService, so it fails to compile if the session API changes.
 */
export function provideFakeSession(role: Role | null = 'reader'): Provider[] {
  const current = signal<Role | null>(role);
  const status = signal<SessionStatus>(role ? 'ready' : 'signed-out');
  const fake = {
    role: current,
    status,
    notice: signal(''),
    profile: signal<CurrentUser | null>(null),
    user: signal<User | null>(null),
    loginAvailable: true,
    hasRole: (minimum: Role) => roleAtLeast(current(), minimum),
    ready: async () => (role ? 'ready' : 'signed-out') as 'ready' | 'signed-out',
    signIn: async () => 'ready' as const,
    retryProfile: async () => 'ready' as const,
    signOut: async () => undefined,
  } satisfies Partial<SessionService>;
  return [{ provide: SessionService, useValue: fake }];
}
