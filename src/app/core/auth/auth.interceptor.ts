import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { DOCUMENT, inject } from '@angular/core';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';
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

/** A local 401 for the request, so the screens show the usual "session expired" message. */
function unauthorized(request: HttpRequest<unknown>): HttpErrorResponse {
  return new HttpErrorResponse({ status: 401, statusText: 'Unauthorized', url: request.url });
}

/**
 * Attaches `Authorization: Bearer <Firebase ID token>` to API requests. On a 401 it forces one token refresh
 * (`getIdToken(true)`: a role change revokes the session, FRONTEND.md §2) and retries once. The session is over
 * when the retry is still a 401 or when Firebase refuses to give a token (revoked refresh token, disabled user):
 * then `AuthEvents.sessionExpired` sends the person back to the login.
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

  const expired = (): Observable<never> => {
    events.sessionExpired.next();
    return throwError(() => unauthorized(request));
  };
  const token = (forceRefresh: boolean): Observable<string | null> =>
    from(firebase.idToken(forceRefresh)).pipe(catchError(() => expired()));

  return token(false).pipe(
    switchMap((current) => {
      if (!current) return next(request);
      return next(withBearer(request, current)).pipe(
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
            return throwError(() => error);
          }
          return token(true).pipe(
            switchMap((fresh) => {
              if (!fresh) return expired();
              return next(withBearer(request, fresh)).pipe(
                catchError((retryError: unknown) =>
                  retryError instanceof HttpErrorResponse && retryError.status === 401
                    ? expired()
                    : throwError(() => retryError),
                ),
              );
            }),
          );
        }),
      );
    }),
  );
};
