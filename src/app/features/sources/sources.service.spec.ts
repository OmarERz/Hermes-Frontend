import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { ApiError } from '../../core/api/api-error';
import { makeSource } from './source-fixtures';
import { SourcesService } from './sources.service';

const API = 'http://127.0.0.1:8000';

describe('SourcesService', () => {
  let service: SourcesService;
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
            apiBaseUrl: API,
            firebase: null,
            authEmulatorUrl: null,
            itopBaseUrl: null,
          },
        },
      ],
    });
    service = TestBed.inject(SourcesService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('reads every page, passing back the opaque cursor as received', async () => {
    const all = firstValueFrom(service.listAll());
    const first = backend.expectOne((req) => req.url === `${API}/api/sources`);
    expect(first.request.params.get('limit')).toBe('200');
    expect(first.request.params.has('cursor')).toBe(false);
    first.flush({ items: [makeSource({ id: 'a' })], next_cursor: 'p2.sig' });

    const second = backend.expectOne((req) => req.url === `${API}/api/sources`);
    expect(second.request.params.get('cursor')).toBe('p2.sig');
    second.flush({ items: [makeSource({ id: 'b' })], next_cursor: null });

    expect((await all).map((source) => source.id)).toEqual(['a', 'b']);
  });

  it('switches a source with PATCH and returns the saved source', async () => {
    const saved = firstValueFrom(service.update('abc', { active: false }));
    const request = backend.expectOne(`${API}/api/sources/abc`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ active: false });
    request.flush(makeSource({ id: 'abc', active: false, structural: false }));
    expect((await saved).active).toBe(false);
  });

  it('adds a feed with POST', async () => {
    const created = firstValueFrom(
      service.create({ name: 'Boletín', url: 'https://feeds.example.test/a.xml', kind: 'rss' }),
    );
    const request = backend.expectOne(`${API}/api/sources`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Boletín',
      url: 'https://feeds.example.test/a.xml',
      kind: 'rss',
    });
    request.flush(makeSource({ name: 'Boletín', type: 'feed', level: 'N4', active: false }), {
      status: 201,
      statusText: 'Created',
    });
    expect((await created).level).toBe('N4');
  });

  it('hands the API refusal over as an ApiError', async () => {
    const refused = firstValueFrom(service.update('abc', { active: false })).catch(
      (error: unknown) => error,
    );
    backend.expectOne(`${API}/api/sources/abc`).flush(
      {
        error: {
          code: 'structural_source',
          message: 'Las fuentes estructurales no se pueden desactivar.',
          details: [],
        },
      },
      { status: 409, statusText: 'Conflict' },
    );
    const error = (await refused) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('structural_source');
  });
});
