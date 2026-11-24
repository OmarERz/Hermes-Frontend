import { TestBed } from '@angular/core/testing';
import type { Auth } from 'firebase/auth';
import type { AppConfig } from '../config/app-config';
import { createFirebaseAuth, FIREBASE_AUTH, FirebaseAuthService } from './firebase-auth.service';

describe('FirebaseAuthService.idToken', () => {
  function setup(currentUser: { getIdToken: (force?: boolean) => Promise<string> } | null) {
    const auth = { currentUser, authStateReady: vi.fn(async () => undefined) } as unknown as Auth;
    TestBed.configureTestingModule({ providers: [{ provide: FIREBASE_AUTH, useValue: auth }] });
    return { service: TestBed.inject(FirebaseAuthService), auth };
  }

  it('waits for the persisted session before reading the user', async () => {
    const getIdToken = vi.fn(async () => 'token');
    let restored = false;
    const auth = {
      get currentUser() {
        return restored ? { getIdToken } : null;
      },
      authStateReady: vi.fn(async () => {
        await Promise.resolve();
        restored = true;
      }),
    } as unknown as Auth;
    TestBed.configureTestingModule({ providers: [{ provide: FIREBASE_AUTH, useValue: auth }] });
    const service = TestBed.inject(FirebaseAuthService);
    await expect(service.idToken()).resolves.toBe('token');
    expect(getIdToken).toHaveBeenCalledWith();
  });

  it('returns null without a signed-in user', async () => {
    const { service } = setup(null);
    await expect(service.idToken(true)).resolves.toBeNull();
  });

  it('shares one forced refresh between concurrent callers', async () => {
    let release!: (token: string) => void;
    const getIdToken = vi.fn((force?: boolean) =>
      force ? new Promise<string>((resolve) => (release = resolve)) : Promise.resolve('old'),
    );
    const { service } = setup({ getIdToken });
    const first = service.idToken(true);
    const second = service.idToken(true);
    await new Promise((resolve) => setTimeout(resolve));
    release('fresh');
    await expect(Promise.all([first, second])).resolves.toEqual(['fresh', 'fresh']);
    expect(getIdToken).toHaveBeenCalledTimes(1);
    // Once settled, the next forced refresh asks Firebase again.
    const third = service.idToken(true);
    await new Promise((resolve) => setTimeout(resolve));
    release('newer');
    await expect(third).resolves.toBe('newer');
    expect(getIdToken).toHaveBeenCalledTimes(2);
  });

  it('works without a Firebase config', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: FIREBASE_AUTH, useValue: null }] });
    const service = TestBed.inject(FirebaseAuthService);
    expect(service.configured).toBe(false);
    await expect(service.idToken()).resolves.toBeNull();
  });
});

describe('createFirebaseAuth', () => {
  const base: AppConfig = {
    production: false,
    apiBaseUrl: 'http://127.0.0.1:8000',
    firebase: null,
    authEmulatorUrl: null,
    itopBaseUrl: null,
  };

  it('returns null without a Firebase web config', () => {
    expect(createFirebaseAuth(base)).toBeNull();
  });

  it('connects to the emulator when one is configured (no network until sign-in)', () => {
    const auth = createFirebaseAuth({
      ...base,
      firebase: {
        apiKey: 'demo-api-key',
        authDomain: 'demo-hermes.firebaseapp.com',
        projectId: 'demo-hermes',
        appId: 'demo-hermes-web',
      },
      authEmulatorUrl: 'http://127.0.0.1:9099',
    });
    expect(auth?.app.options.projectId).toBe('demo-hermes');
    expect(auth?.emulatorConfig).toMatchObject({ host: '127.0.0.1', port: 9099, protocol: 'http' });
  });
});

describe('FirebaseAuthService session calls', () => {
  function withAuth(auth: Partial<Auth> | null): FirebaseAuthService {
    TestBed.configureTestingModule({ providers: [{ provide: FIREBASE_AUTH, useValue: auth }] });
    return TestBed.inject(FirebaseAuthService);
  }

  it('watches the user through the SDK and stops on unsubscribe', () => {
    const stop = vi.fn();
    const onAuthStateChanged = vi.fn(() => stop);
    const service = withAuth({ onAuthStateChanged } as Partial<Auth>);
    const listener = vi.fn();
    const onError = vi.fn();
    const unsubscribe = service.watchUser(listener, onError);
    expect(service.configured).toBe(true);
    expect(onAuthStateChanged).toHaveBeenCalledWith(listener, onError, undefined);
    unsubscribe();
    expect(stop).toHaveBeenCalled();
  });

  it('reports no user at once when Firebase is not configured', () => {
    const service = withAuth(null);
    const listener = vi.fn();
    const unsubscribe = service.watchUser(listener, vi.fn());
    expect(listener).toHaveBeenCalledWith(null);
    expect(() => unsubscribe()).not.toThrow();
  });

  it('refuses to sign in without a Firebase config', async () => {
    await expect(withAuth(null).signIn('reader@hermes.test', 'x')).rejects.toThrow(
      'firebase-not-configured',
    );
  });

  it('signs out through the SDK, and does nothing without a config', async () => {
    const signOut = vi.fn(async () => undefined);
    await withAuth({ signOut } as Partial<Auth>).signOut();
    expect(signOut).toHaveBeenCalledTimes(1);

    TestBed.resetTestingModule();
    await expect(withAuth(null).signOut()).resolves.toBeUndefined();
  });
});
