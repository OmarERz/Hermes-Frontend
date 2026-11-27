import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { ApiError } from './api-error';
import { ApiClient, ApiResult, fillPath } from './api-client';

describe('ApiClient', () => {
  let api: ApiClient;
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
            itopBaseUrl: null,
          },
        },
      ],
    });
    api = TestBed.inject(ApiClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('fills path parameters (encoded) and sends the query without empty values', async () => {
    const result = firstValueFrom(api.get('/api/assets/{ci_id}', { path: { ci_id: 'srv/01 a' } }));
    backend.expectOne('http://127.0.0.1:8000/api/assets/srv%2F01%20a').flush({ ci_id: 'srv/01 a' });
    await expect(result).resolves.toMatchObject({ ci_id: 'srv/01 a' });

    const list = firstValueFrom(api.get('/api/tickets', { query: { limit: 10, cursor: null } }));
    const request = backend.expectOne((req) => req.url === 'http://127.0.0.1:8000/api/tickets');
    expect(request.request.params.keys()).toEqual(['limit']);
    request.flush({ items: [], next_cursor: null });
    await list;
  });

  it('sends the JSON body with the right method', async () => {
    const result = firstValueFrom(
      api.put('/api/config', { body: { changes: { 'weights.S': '0.30' }, expected_version: 3 } }),
    );
    const request = backend.expectOne('http://127.0.0.1:8000/api/config');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ changes: { 'weights.S': '0.30' }, expected_version: 3 });
    request.flush({ version: 4 });
    await result;
  });

  it('sends POST, PATCH and DELETE to the filled path', async () => {
    const approved = firstValueFrom(
      api.post('/api/calibration/proposals/{id}/approve', { path: { id: 'p 1' } }),
    );
    const approve = backend.expectOne(
      'http://127.0.0.1:8000/api/calibration/proposals/p%201/approve',
    );
    expect(approve.request.method).toBe('POST');
    approve.flush({});
    await approved;

    const patched = firstValueFrom(
      api.patch('/api/sources/{id}', { path: { id: '7' }, body: { active: false } }),
    );
    const patch = backend.expectOne('http://127.0.0.1:8000/api/sources/7');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ active: false });
    patch.flush({});
    await patched;

    const deleted = firstValueFrom(api.delete('/api/peer-companies/{id}', { path: { id: '3' } }));
    const remove = backend.expectOne('http://127.0.0.1:8000/api/peer-companies/3');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    await deleted;
  });

  it('fails with an ApiError, without a request, when a path parameter is empty', async () => {
    const result = firstValueFrom(api.get('/api/assets/{ci_id}', { path: { ci_id: '' } })).catch(
      (error: unknown) => error,
    );
    await expect(result).resolves.toBeInstanceOf(ApiError);
    backend.expectNone(() => true);
  });

  it('maps failures to ApiError', async () => {
    const result = firstValueFrom(api.get('/api/me')).catch((error: unknown) => error);
    backend
      .expectOne('http://127.0.0.1:8000/api/me')
      .flush(
        { error: { code: 'forbidden', message: 'No tienes permiso.', details: [] } },
        { status: 403, statusText: 'Forbidden' },
      );
    await expect(result).resolves.toBeInstanceOf(ApiError);
    await expect(result).resolves.toMatchObject({ code: 'forbidden' });
  });

  it('is typed by the OpenAPI (compile-time checks)', () => {
    const typed = (): void => {
      // @ts-expect-error: the route has a path parameter, so the options are required.
      void api.get('/api/vulnerabilities/{group_id}');
      // @ts-expect-error: unknown query parameter.
      void api.get('/api/vulnerabilities', { query: { nope: 1 } });
      // @ts-expect-error: not a GET route.
      void api.get('/api/feedback');
      // @ts-expect-error: the run events are a stream (SSE), not JSON.
      void api.get('/api/runs/{id}/events', { path: { id: 'x' } });
      // @ts-expect-error: body required for PUT /api/config.
      void api.put('/api/config');
      const me: ApiResult<'/api/me', 'get'> = {
        uid: 'u',
        email: 'e',
        display_name: null,
        role: 'reader',
      };
      void me;
    };
    expect(typed).toBeTypeOf('function');
  });
});

describe('fillPath', () => {
  it('rejects a missing path parameter', () => {
    expect(() => fillPath('/api/assets/{ci_id}', {})).toThrowError('Missing path parameter: ci_id');
  });
});
