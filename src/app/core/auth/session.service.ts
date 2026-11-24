import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { User } from 'firebase/auth';
import { FirebaseAuthService } from './firebase-auth.service';

export type SessionStatus = 'initializing' | 'signed-out' | 'signed-in';

/** Session state of the app: the Firebase user, as signals. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly firebase = inject(FirebaseAuthService);

  readonly status = signal<SessionStatus>('initializing');
  readonly user = signal<User | null>(null);

  private resolveInitialized!: () => void;
  private readonly initialized = new Promise<void>(
    (resolve) => (this.resolveInitialized = resolve),
  );

  constructor() {
    const stop = this.firebase.watchUser(
      (user) => {
        this.user.set(user);
        this.status.set(user ? 'signed-in' : 'signed-out');
        this.resolveInitialized();
      },
      () => {
        this.user.set(null);
        this.status.set('signed-out');
        this.resolveInitialized();
      },
    );
    inject(DestroyRef).onDestroy(stop);
  }

  /** False when the app has no Firebase web config (the login screen explains it). */
  get loginAvailable(): boolean {
    return this.firebase.configured;
  }

  /** Waits until Firebase restores the persisted session, then reports the status. */
  async ready(): Promise<SessionStatus> {
    await this.initialized;
    return this.status();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.ready();
    const user = await this.firebase.signIn(email, password);
    this.user.set(user);
    this.status.set('signed-in');
  }

  async signOut(): Promise<void> {
    await this.ready();
    await this.firebase.signOut();
    this.user.set(null);
    this.status.set('signed-out');
  }
}
