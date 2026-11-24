import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { Role } from '../api/api-types';
import { MIN_ROLE } from './roles';
import { SessionService } from './session.service';

/** Lets in only a signed-in user whose profile (effective role) is loaded; the rest go to the login. */
export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return (await session.ready()) === 'ready' ? true : router.createUrlTree(['/login']);
};

/**
 * Checks the minimum role of the screen (route data `minRole`, `reader` when absent) against the effective role.
 * A role that does not reach it goes to the "sin permiso" screen. The backend enforces the same table.
 */
export const roleGuard: CanActivateFn = async (route) => {
  const session = inject(SessionService);
  const router = inject(Router);
  if ((await session.ready()) !== 'ready') return router.createUrlTree(['/login']);
  const minimum = (route.data[MIN_ROLE] as Role | undefined) ?? 'reader';
  return session.hasRole(minimum) ? true : router.createUrlTree(['/sin-permiso']);
};

/** The login screen is for people without a session; a signed-in user goes to the start screen. */
export const guestGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return (await session.ready()) === 'ready' ? router.createUrlTree(['/inicio']) : true;
};
