import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import type { Role } from '../api/api-types';
import { authGuard, guestGuard, roleGuard } from './auth.guards';
import { roleAtLeast } from './roles';
import { SessionService, SessionStatus } from './session.service';

function setup(status: SessionStatus, role: Role | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: SessionService,
        useValue: {
          ready: async () => status,
          hasRole: (minimum: Role) => status === 'ready' && roleAtLeast(role, minimum),
        },
      },
    ],
  });
}

function routeWith(data: Record<string, unknown>): ActivatedRouteSnapshot {
  return { data } as unknown as ActivatedRouteSnapshot;
}

async function run(
  guard: typeof roleGuard,
  data: Record<string, unknown> = {},
): Promise<true | string> {
  const result = await TestBed.runInInjectionContext(() =>
    guard(routeWith(data), {} as RouterStateSnapshot),
  );
  if (result === true) return true;
  return TestBed.inject(Router).serializeUrl(result as UrlTree);
}

describe('roleGuard', () => {
  it('lets in a role that reaches the minimum of the screen', async () => {
    setup('ready', 'analyst');
    await expect(run(roleGuard, { minRole: 'analyst' })).resolves.toBe(true);
    await expect(run(roleGuard, { minRole: 'reader' })).resolves.toBe(true);
  });

  it('defaults to reader when the route declares no role', async () => {
    setup('ready', 'reader');
    await expect(run(roleGuard)).resolves.toBe(true);
  });

  it('sends a lower role to the forbidden screen', async () => {
    setup('ready', 'reader');
    await expect(run(roleGuard, { minRole: 'admin' })).resolves.toBe('/sin-permiso');
  });

  it('sends a person without a session to the login', async () => {
    setup('signed-out', null);
    await expect(run(roleGuard, { minRole: 'reader' })).resolves.toBe('/login');
  });
});

describe('authGuard and guestGuard', () => {
  it('authGuard needs a loaded profile', async () => {
    setup('signed-out', null);
    await expect(run(authGuard)).resolves.toBe('/login');
  });

  it('authGuard lets a ready session in', async () => {
    setup('ready', 'reader');
    await expect(run(authGuard)).resolves.toBe(true);
  });

  it('guestGuard sends a signed-in user to the start screen', async () => {
    setup('ready', 'admin');
    await expect(run(guestGuard)).resolves.toBe('/inicio');
  });

  it('guestGuard shows the login without a session', async () => {
    setup('signed-out', null);
    await expect(run(guestGuard)).resolves.toBe(true);
  });
});

describe('roleAtLeast', () => {
  it('follows reader < analyst < admin', () => {
    expect(roleAtLeast('admin', 'analyst')).toBe(true);
    expect(roleAtLeast('analyst', 'admin')).toBe(false);
    expect(roleAtLeast(null, 'reader')).toBe(false);
  });
});
