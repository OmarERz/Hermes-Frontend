import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { DOCUMENT, inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { AuthEvents } from './auth-events';
import { FirebaseAuthService } from './firebase-auth.service';

/**
 * True only for requests to the backend API: the same origin as `apiBaseUrl` ('' = the origin serving the front)
 * and a path under `<base path>/api/`. Any other origin (Firebase, fonts, a CDN) never gets the token.
 */
export function isApiRequest(url: string, apiBaseUrl: string, baseUri: string): boolean {
  let target: URL;
  let api: URL;
  try {
    target = new URL(url, baseUri);
    api = new URL(apiBaseUrl || '/', baseUri);
  } catch {
    return false;
  }
  const prefix = `${api.pathname.replace(/\/+$/, '')}/api/`;
  return target.origin === api.origin && target.pathname.startsWith(prefix);
}

function withBearer(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Attaches `Authorization: Bearer <Firebase ID token>` to API requests. On a 401 it forces one token refresh
 * (`getIdToken(true)`: a role change revokes the session, FRONTEND.md §2) and retries once; a second 401 raises
 * `AuthEvents.sessionExpired` so the session sends the person back to the login.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_CONFIG);
  const baseUri = inject(DOCUMENT).baseURI;
  if (
    request.headers.has('Authorization') ||
    !isApiRequest(request.url, config.apiBaseUrl, baseUri)
  ) {
    return next(request);
  }
  const firebase = inject(FirebaseAuthService);
  const events = inject(AuthEvents);

  return from(firebase.idToken()).pipe(
    switchMap((token) => {
      if (!token) return next(request);
      return next(withBearer(request, token)).pipe(
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
            return throwError(() => error);
          }
          return from(firebase.idToken(true)).pipe(
            switchMap((fresh) => next(fresh ? withBearer(request, fresh) : request)),
            catchError((retryError: unknown) => {
              if (retryError instanceof HttpErrorResponse && retryError.status === 401) {
                events.sessionExpired.next();
              }
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};
