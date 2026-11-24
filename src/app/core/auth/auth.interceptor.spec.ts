import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { Mock } from 'vitest';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { AuthEvents } from './auth-events';
import { authInterceptor, isApiRequest } from './auth.interceptor';
import { FirebaseAuthService } from './firebase-auth.service';

const config: AppConfig = {
  production: false,
  apiBaseUrl: 'http://127.0.0.1:8000',
  firebase: null,
  authEmulatorUrl: null,
};

describe('isApiRequest', () => {
  const base = 'http://localhost:4200/';

  it.each([
    ['http://127.0.0.1:8000/api/vulnerabilities', 'http://127.0.0.1:8000', true],
    ['http://127.0.0.1:8000/api/me?x=1', 'http://127.0.0.1:8000/', true],
    ['/api/me', '', true],
    ['http://localhost:4200/api/me', '', true],
    ['https://hermes.test/prefix/api/me', 'https://hermes.test/prefix', true],
    ['http://127.0.0.1:8000/health', 'http://127.0.0.1:8000', false],
    ['http://127.0.0.1:8000/apiary', 'http://127.0.0.1:8000', false],
    ['http://127.0.0.1:8000/api/../other', 'http://127.0.0.1:8000', false],
    ['https://evil.test/api/me', 'http://127.0.0.1:8000', false],
    ['http://127.0.0.1:9099/api/me', 'http://127.0.0.1:8000', false],
    ['https://identitytoolkit.googleapis.com/v1/accounts', '', false],
    ['//evil.test/api/me', '', false],
  ])('%s with base %j is an API request: %s', (url, apiBaseUrl, expected) => {
    expect(isApiRequest(url, apiBaseUrl, base)).toBe(expected);
  });
});

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let idToken: Mock<(force?: boolean) => Promise<string | null>>;
  let expired: Mock<() => void>;

  beforeEach(() => {
    idToken = vi.fn(async (force?: boolean) => (force ? 'fresh-token' : 'cached-token'));
    expired = vi.fn<() => void>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: config },
        { provide: FirebaseAuthService, useValue: { idToken } },
      ],
    });
    TestBed.inject(AuthEvents).sessionExpired.subscribe(() => expired());
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Lets the token promise resolve before looking for the outgoing request. */
  const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve));

  it('attaches the bearer token to API requests', async () => {
    const result = firstValueFrom(http.get('http://127.0.0.1:8000/api/me'));
    await flushMicrotasks();
    const request = backend.expectOne('http://127.0.0.1:8000/api/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer cached-token');
    request.flush({ uid: 'u1' });
    await expect(result).resolves.toEqual({ uid: 'u1' });
    expect(idToken).toHaveBeenCalledWith(false);
  });

  it('never sends the token to another origin', async () => {
    const result = firstValueFrom(http.get('https://evil.test/api/me'));
    await flushMicrotasks();
    const request = backend.expectOne('https://evil.test/api/me');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
    await result;
    expect(idToken).not.toHaveBeenCalled();
  });

  it('sends the request without a token when nobody is signed in', async () => {
    idToken.mockResolvedValue(null);
    const result = firstValueFrom(http.get('http://127.0.0.1:8000/api/me'));
    await flushMicrotasks();
    const request = backend.expectOne('http://127.0.0.1:8000/api/me');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(idToken).toHaveBeenCalledTimes(1);
  });

  it('refreshes the token once on a 401 and retries', async () => {
    const result = firstValueFrom(http.get('http://127.0.0.1:8000/api/me'));
    await flushMicrotasks();
    backend
      .expectOne('http://127.0.0.1:8000/api/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();
    const retry = backend.expectOne('http://127.0.0.1:8000/api/me');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retry.flush({ uid: 'u1' });
    await expect(result).resolves.toEqual({ uid: 'u1' });
    expect(idToken).toHaveBeenLastCalledWith(true);
    expect(expired).not.toHaveBeenCalled();
  });

  it('reports an expired session when the retry is still a 401', async () => {
    const result = firstValueFrom(http.get('http://127.0.0.1:8000/api/me'));
    await flushMicrotasks();
    backend
      .expectOne('http://127.0.0.1:8000/api/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();
    backend
      .expectOne('http://127.0.0.1:8000/api/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
    expect(idToken).toHaveBeenCalledTimes(2);
  });

  it('ends the session when Firebase refuses to refresh the token (revoked session)', async () => {
    idToken.mockImplementation(async (force?: boolean) => {
      if (force) throw Object.assign(new Error('revoked'), { code: 'auth/user-token-expired' });
      return 'cached-token';
    });
    const result = firstValueFrom(http.get('http://127.0.0.1:8000/api/me')).catch(
      (error: unknown) => error,
    );
    await flushMicrotasks();
    backend
      .expectOne('http://127.0.0.1:8000/api/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(result).resolves.toBeInstanceOf(HttpErrorResponse);
    await expect(result).resolves.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('ends the session when Firebase cannot give the current token', async () => {
    idToken.mockRejectedValue(Object.assign(new Error('disabled'), { code: 'auth/user-disabled' }));
    const result = firstValueFrom(http.get('http://127.0.0.1:8000/api/me')).catch(
      (error: unknown) => error,
    );
    await flushMicrotasks();
    backend.expectNone('http://127.0.0.1:8000/api/me');
    await expect(result).resolves.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('leaves a request that already carries an Authorization header untouched', async () => {
    const result = firstValueFrom(
      http.get('http://127.0.0.1:8000/api/me', { headers: { Authorization: 'Bearer explicit' } }),
    );
    await flushMicrotasks();
    const request = backend.expectOne('http://127.0.0.1:8000/api/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer explicit');
    request.flush({});
    await result;
    expect(idToken).not.toHaveBeenCalled();
  });

  it('does not retry other errors', async () => {
    const result = firstValueFrom(http.get('http://127.0.0.1:8000/api/me'));
    await flushMicrotasks();
    backend
      .expectOne('http://127.0.0.1:8000/api/me')
      .flush(null, { status: 403, statusText: 'Forbidden' });
    await expect(result).rejects.toMatchObject({ status: 403 });
    expect(idToken).toHaveBeenCalledTimes(1);
  });
});
