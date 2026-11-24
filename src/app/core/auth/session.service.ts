import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { User } from 'firebase/auth';
import { ApiError, toApiError } from '../api/api-error';
import type { CurrentUser, Role } from '../api/api-types';
import { HermesApi } from '../api/hermes-api';
import { AuthEvents } from './auth-events';
import { FirebaseAuthService } from './firebase-auth.service';
import { roleAtLeast } from './roles';

/**
 * - initializing: Firebase is restoring the persisted session.
 * - loading-profile: signed in to Firebase; waiting for GET /api/me.
 * - ready: signed in, with the effective role from the backend.
 * - profile-error: signed in to Firebase, but GET /api/me failed for a transient reason (no connection, 429,
 *   503 `auth_unavailable`, 5xx); the Firebase session is kept and the login screen offers a retry.
 * - signed-out: no session (or it ended: see `notice`).
 */
export type SessionStatus =
  'initializing' | 'loading-profile' | 'ready' | 'profile-error' | 'signed-out';

type SettledStatus = 'ready' | 'profile-error' | 'signed-out';

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró o fue revocada. Inicia sesión de nuevo.';

/** 401 (token refused) and 403 (`user_inactive`) end the session; anything else is worth a retry. */
function endsSession(error: ApiError): boolean {
  return error.status === 401 || error.status === 403;
}

/**
 * Session of the app, as signals: the Firebase user plus the profile and **effective role** from `GET /api/me`
 * (the lower of the token claim and the backend copy, FRONTEND.md §2). The role is never read from the token.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly firebase = inject(FirebaseAuthService);
  private readonly api = inject(HermesApi);
  private readonly router = inject(Router);

  readonly status = signal<SessionStatus>('initializing');
  readonly user = signal<User | null>(null);
  readonly profile = signal<CurrentUser | null>(null);
  readonly role = computed<Role | null>(() => this.profile()?.role ?? null);
  /** Why the last session ended or the profile failed (shown by the login screen); empty otherwise. */
  readonly notice = signal('');

  private waiters: ((status: SettledStatus) => void)[] = [];
  private profileRequest = 0;

  constructor() {
    const stop = this.firebase.watchUser(
      (user) => this.onUser(user),
      () => this.onUser(null),
    );
    const expired = inject(AuthEvents).sessionExpired.subscribe(() => this.expire());
    inject(DestroyRef).onDestroy(() => {
      stop();
      expired.unsubscribe();
    });
  }

  /** False when the app has no Firebase web config (the login screen explains it). */
  get loginAvailable(): boolean {
    return this.firebase.configured;
  }

  /** True when the effective role reaches `minimum` (reader < analyst < admin). */
  hasRole(minimum: Role): boolean {
    return this.status() === 'ready' && roleAtLeast(this.role(), minimum);
  }

  /** Resolves once the session settles: `ready`, `profile-error` or `signed-out`. */
  ready(): Promise<SettledStatus> {
    const status = this.status();
    if (status === 'ready' || status === 'profile-error' || status === 'signed-out') {
      return Promise.resolve(status);
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /**
   * Signs in with Firebase and loads the profile. Firebase errors are thrown (the login screen translates
   * them); a profile failure resolves `signed-out` or `profile-error` with the reason in `notice`.
   */
  async signIn(email: string, password: string): Promise<SettledStatus> {
    await this.ready();
    this.notice.set('');
    const user = await this.firebase.signIn(email, password);
    this.onUser(user);
    return this.ready();
  }

  /** Asks GET /api/me again after a transient failure, keeping the Firebase session. */
  retryProfile(): Promise<SettledStatus> {
    const user = this.user();
    if (this.status() === 'profile-error' && user) this.loadProfile(user);
    return this.ready();
  }

  async signOut(): Promise<void> {
    this.notice.set('');
    await this.end('');
  }

  private onUser(user: User | null): void {
    const status = this.status();
    if (!user) {
      // Firebase dropped a live session by itself: revoked or expired refresh token, user disabled, or a
      // sign-out in another tab. A sign-out started here has already moved the status to signed-out.
      if (status === 'ready' || status === 'loading-profile' || status === 'profile-error') {
        this.expire();
        return;
      }
      this.user.set(null);
      this.profile.set(null);
      this.profileRequest++;
      this.settle('signed-out');
      return;
    }
    if (this.user()?.uid === user.uid && (status === 'loading-profile' || status === 'ready')) {
      return;
    }
    this.loadProfile(user);
  }

  private loadProfile(user: User): void {
    this.user.set(user);
    this.profile.set(null);
    this.status.set('loading-profile');
    const request = ++this.profileRequest;
    this.api.getCurrentUser().subscribe({
      next: (profile) => {
        if (request !== this.profileRequest) return;
        this.notice.set('');
        this.profile.set(profile);
        this.settle('ready');
      },
      error: (error: unknown) => {
        if (request !== this.profileRequest) return;
        const failure = toApiError(error);
        if (endsSession(failure)) {
          void this.end(failure.message);
        } else {
          this.notice.set(failure.message);
          this.settle('profile-error');
        }
      },
    });
  }

  /** The API or Firebase refused the session: end it once and go back to the login with the reason. */
  private expire(): void {
    if (this.status() === 'signed-out') return;
    void this.end(SESSION_EXPIRED_MESSAGE).then(() => this.router.navigate(['/login']));
  }

  /** Ends the session: forgets the profile, signs out of Firebase and keeps the reason for the login. */
  private async end(reason: string): Promise<void> {
    this.profileRequest++;
    if (reason) this.notice.set(reason);
    this.profile.set(null);
    this.user.set(null);
    this.settle('signed-out');
    try {
      await this.firebase.signOut();
    } catch {
      // The local session is already gone; Firebase clears its own copy on the next start.
    }
  }

  private settle(status: SettledStatus): void {
    this.status.set(status);
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) resolve(status);
  }
}
