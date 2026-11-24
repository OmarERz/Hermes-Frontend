import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

/** Waits for Firebase to restore the session and lets only a signed-in user in. */
export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  const status = await session.ready();
  return status === 'signed-in' ? true : router.createUrlTree(['/login']);
};
