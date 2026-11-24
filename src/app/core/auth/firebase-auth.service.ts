import { inject, Injectable, InjectionToken } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  Unsubscribe,
  User,
} from 'firebase/auth';
import { APP_CONFIG, AppConfig } from '../config/app-config';

/** Firebase Auth instance of the app, or null when no Firebase web config is available. */
export const FIREBASE_AUTH = new InjectionToken<Auth | null>('FIREBASE_AUTH', {
  providedIn: 'root',
  factory: () => createFirebaseAuth(inject(APP_CONFIG)),
});

/**
 * Creates the Auth instance with email and password only: `initializeAuth` without the popup and redirect
 * resolver keeps that code out of the bundle. The SDK keeps its own session (IndexedDB, then localStorage as the
 * SDK fallback); the app never stores tokens itself.
 */
export function createFirebaseAuth(config: AppConfig): Auth | null {
  if (!config.firebase) return null;
  const app = initializeApp(config.firebase);
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });
  if (config.authEmulatorUrl) {
    connectAuthEmulator(auth, config.authEmulatorUrl, { disableWarnings: true });
  }
  return auth;
}

/** Thin wrapper over the Firebase Auth SDK, so the rest of the app (and its tests) never touch the SDK. */
@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private readonly auth = inject(FIREBASE_AUTH);

  /** False when the app has no Firebase web config (login is unavailable). */
  get configured(): boolean {
    return this.auth !== null;
  }

  /** Calls `listener` with the current user once Firebase restores the session, and on every change. */
  watchUser(listener: (user: User | null) => void, onError: (error: unknown) => void): Unsubscribe {
    if (!this.auth) {
      listener(null);
      return () => undefined;
    }
    return onAuthStateChanged(this.auth, listener, onError);
  }

  private refreshing: Promise<string | null> | null = null;

  /**
   * The Firebase ID token of the signed-in user (renewed by the SDK when it is about to expire). Waits for the
   * persisted session to be restored first. A forced refresh is shared by concurrent callers, so parallel 401s
   * cause one refresh. Rejects when Firebase refuses the session (revoked refresh token, disabled user).
   */
  async idToken(forceRefresh = false): Promise<string | null> {
    if (!this.auth) return null;
    await this.auth.authStateReady();
    const user = this.auth.currentUser;
    if (!user) return null;
    if (!forceRefresh) return user.getIdToken();
    this.refreshing ??= user.getIdToken(true).finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  async signIn(email: string, password: string): Promise<User> {
    if (!this.auth) throw new Error('firebase-not-configured');
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    return credential.user;
  }

  async signOut(): Promise<void> {
    if (this.auth) await signOut(this.auth);
  }
}
