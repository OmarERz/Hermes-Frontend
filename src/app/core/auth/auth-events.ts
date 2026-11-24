import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Auth events raised by the HTTP layer and handled by the session, so the interceptor never depends on the
 * session service (which itself makes API calls).
 */
@Injectable({ providedIn: 'root' })
export class AuthEvents {
  /** The API still answered 401 after a forced token refresh: the session is no longer valid. */
  readonly sessionExpired = new Subject<void>();
}
