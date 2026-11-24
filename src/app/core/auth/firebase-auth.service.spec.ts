import { TestBed } from '@angular/core/testing';
import type { Auth } from 'firebase/auth';
import { FIREBASE_AUTH, FirebaseAuthService } from './firebase-auth.service';

describe('FirebaseAuthService.idToken', () => {
  function setup(currentUser: { getIdToken: (force?: boolean) => Promise<string> } | null) {
    const order: string[] = [];
    const auth = {
      currentUser,
      authStateReady: vi.fn(async () => {
        order.push('ready');
      }),
    } as unknown as Auth;
    TestBed.configureTestingModule({ providers: [{ provide: FIREBASE_AUTH, useValue: auth }] });
    return { service: TestBed.inject(FirebaseAuthService), auth, order };
  }

  it('waits for the persisted session before reading the user', async () => {
    const getIdToken = vi.fn(async () => 'token');
    const { service, auth } = setup({ getIdToken });
    await expect(service.idToken()).resolves.toBe('token');
    expect(auth.authStateReady).toHaveBeenCalled();
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
