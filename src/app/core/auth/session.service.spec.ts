import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { User } from 'firebase/auth';
import { APP_CONFIG } from '../config/app-config';
import { AuthEvents } from './auth-events';
import { FirebaseAuthService } from './firebase-auth.service';
import { SESSION_EXPIRED_MESSAGE, SessionService } from './session.service';

const ME = 'http://127.0.0.1:8000/api/me';

class FakeFirebase {
  configured = true;
  private listener: ((user: User | null) => void) | null = null;
  watchUser(listener: (user: User | null) => void): () => void {
    this.listener = listener;
    return () => undefined;
  }
  signIn = vi.fn(async (email: string) => ({ uid: 'u1', email }) as User);
  signOut = vi.fn(async () => this.listener?.(null));
  idToken = vi.fn(async () => 'token');
  emit(user: User | null): void {
    this.listener?.(user);
  }
}

describe('SessionService', () => {
  let firebase: FakeFirebase;
  let backend: HttpTestingController;
  let session: SessionService;

  beforeEach(() => {
    firebase = new FakeFirebase();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: FirebaseAuthService, useValue: firebase },
        {
          provide: APP_CONFIG,
          useValue: {
            production: false,
            apiBaseUrl: 'http://127.0.0.1:8000',
            firebase: null,
            authEmulatorUrl: null,
          },
        },
      ],
    });
    session = TestBed.inject(SessionService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const profile = (role: 'reader' | 'analyst' | 'admin') => ({
    uid: 'u1',
    email: 'ana@hermes.test',
    display_name: 'Ana',
    role,
  });

  it('restores a persisted session and takes the effective role from GET /api/me', async () => {
    expect(session.status()).toBe('initializing');
    const ready = session.ready();
    firebase.emit({ uid: 'u1', email: 'ana@hermes.test' } as User);
    expect(session.status()).toBe('loading-profile');
    backend.expectOne(ME).flush(profile('analyst'));
    await expect(ready).resolves.toBe('ready');
    expect(session.role()).toBe('analyst');
    expect(session.hasRole('reader')).toBe(true);
    expect(session.hasRole('analyst')).toBe(true);
    expect(session.hasRole('admin')).toBe(false);
  });

  it('settles signed out when there is no persisted session', async () => {
    firebase.emit(null);
    await expect(session.ready()).resolves.toBe('signed-out');
    expect(session.hasRole('reader')).toBe(false);
  });

  it('ends the session with the backend message when the user is inactive', async () => {
    firebase.emit({ uid: 'u1' } as User);
    backend.expectOne(ME).flush(
      {
        error: {
          code: 'user_inactive',
          message: 'El usuario está desactivado.',
          details: [],
        },
      },
      { status: 403, statusText: 'Forbidden' },
    );
    await expect(session.ready()).resolves.toBe('signed-out');
    expect(session.notice()).toBe('El usuario está desactivado.');
    expect(session.profile()).toBeNull();
    expect(firebase.signOut).toHaveBeenCalled();
  });

  it('signs in and resolves once the profile is loaded', async () => {
    firebase.emit(null);
    const result = session.signIn('ana@hermes.test', 'secreto');
    await new Promise((resolve) => setTimeout(resolve));
    expect(firebase.signIn).toHaveBeenCalledWith('ana@hermes.test', 'secreto');
    backend.expectOne(ME).flush(profile('reader'));
    await expect(result).resolves.toBe('ready');
    expect(session.role()).toBe('reader');
  });

  it('does not ask for the profile twice when Firebase also reports the new user', async () => {
    firebase.emit(null);
    const result = session.signIn('ana@hermes.test', 'secreto');
    await new Promise((resolve) => setTimeout(resolve));
    firebase.emit({ uid: 'u1', email: 'ana@hermes.test' } as User);
    backend.expectOne(ME).flush(profile('admin'));
    await expect(result).resolves.toBe('ready');
  });

  it('goes back to the login when the API reports an expired session', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    firebase.emit({ uid: 'u1' } as User);
    backend.expectOne(ME).flush(profile('admin'));
    await session.ready();
    TestBed.inject(AuthEvents).sessionExpired.next();
    await new Promise((resolve) => setTimeout(resolve));
    expect(session.status()).toBe('signed-out');
    expect(session.notice()).toBe(SESSION_EXPIRED_MESSAGE);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('signs out without leaving a notice', async () => {
    firebase.emit({ uid: 'u1' } as User);
    backend.expectOne(ME).flush(profile('reader'));
    await session.ready();
    await session.signOut();
    expect(session.status()).toBe('signed-out');
    expect(session.notice()).toBe('');
    expect(session.user()).toBeNull();
  });
});
