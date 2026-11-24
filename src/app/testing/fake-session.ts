import { Provider, signal } from '@angular/core';
import type { Role } from '../core/api/api-types';
import { roleAtLeast } from '../core/auth/roles';
import { SessionService } from '../core/auth/session.service';

/**
 * Test double of the session for screen specs: every page banner renders the section tabs, which read the
 * effective role. `provideFakeSession('analyst')` signs in with that role; `null` means no session.
 */
export function provideFakeSession(role: Role | null = 'reader'): Provider[] {
  const current = signal<Role | null>(role);
  return [
    {
      provide: SessionService,
      useValue: {
        role: current,
        status: signal(role ? 'ready' : 'signed-out'),
        notice: signal(''),
        profile: signal(null),
        user: signal(null),
        loginAvailable: true,
        hasRole: (minimum: Role) => roleAtLeast(current(), minimum),
      },
    },
  ];
}
