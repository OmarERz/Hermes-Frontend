import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { ApiError } from './api-error';
import { HermesApi, toHttpParams } from './hermes-api';

describe('HermesApi', () => {
  let api: HermesApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
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
    api = TestBed.inject(HermesApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('calls GET /api/me on the configured base URL', async () => {
    const result = firstValueFrom(api.getCurrentUser());
    const request = backend.expectOne('http://127.0.0.1:8000/api/me');
    expect(request.request.method).toBe('GET');
    request.flush({ uid: 'u1', email: 'a@b.c', display_name: null, role: 'reader' });
    await expect(result).resolves.toMatchObject({ role: 'reader' });
  });

  it('sends only the filters that have a value', async () => {
    const result = firstValueFrom(
      api.listVulnerabilities({ view: 'vulnerability', in_kev: true, band: null, limit: 25 }),
    );
    const request = backend.expectOne(
      (req) => req.url === 'http://127.0.0.1:8000/api/vulnerabilities',
    );
    expect(request.request.params.keys().sort()).toEqual(['in_kev', 'limit', 'view']);
    expect(request.request.params.get('in_kev')).toBe('true');
    request.flush({ view: 'vulnerability', groups: [], next_cursor: null });
    await result;
  });

  it('turns an error envelope into an ApiError', async () => {
    const result = firstValueFrom(api.listVulnerabilities({ cursor: 'a.b' }));
    backend
      .expectOne((req) => req.url.endsWith('/api/vulnerabilities'))
      .flush(
        { error: { code: 'invalid_cursor', message: 'El cursor no es válido.', details: [] } },
        { status: 400, statusText: 'Bad Request' },
      );
    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'invalid_cursor' });
  });
});

describe('toHttpParams', () => {
  it('drops null, undefined and empty strings and stringifies the rest', () => {
    const params = toHttpParams({ a: 'x', b: null, c: undefined, d: '', e: 0, f: false });
    expect(params.toString()).toBe('a=x&e=0&f=false');
  });
});
