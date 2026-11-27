import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { APP_CONFIG } from '../../core/config/app-config';
import { ConnectionsService } from './connections.service';

const API = 'http://127.0.0.1:8000';
const ITOP = {
  name: 'itop' as const,
  ok: true,
  latency_ms: 80,
  missing_variable: null,
  message: 'Conexión correcta',
  checked_at: '2026-11-24T06:00:00Z',
  last_ok_at: '2026-11-24T06:00:00Z',
};

describe('ConnectionsService', () => {
  let service: ConnectionsService;
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
    service = TestBed.inject(ConnectionsService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('reads the last check of every connection', async () => {
    const read = firstValueFrom(service.status());
    const request = backend.expectOne(`${API}/api/connections/status`);
    expect(request.request.method).toBe('GET');
    request.flush([ITOP]);
    expect(await read).toEqual([ITOP]);
  });

  it('checks the connections asked for, or all of them', async () => {
    const one = firstValueFrom(service.test(['itop']));
    const first = backend.expectOne(`${API}/api/connections/test`);
    expect(first.request.method).toBe('POST');
    expect(first.request.body).toEqual({ names: ['itop'] });
    first.flush([ITOP]);
    expect(await one).toEqual([ITOP]);

    const all = firstValueFrom(service.test(null));
    const second = backend.expectOne(`${API}/api/connections/test`);
    expect(second.request.body).toEqual({ names: null });
    second.flush([ITOP]);
    await all;
  });

  it('hands the API refusal over as an ApiError', async () => {
    const read = firstValueFrom(service.status());
    backend
      .expectOne(`${API}/api/connections/status`)
      .flush(
        { error: { code: 'forbidden', message: 'No tienes permiso para realizar esta acción.' } },
        { status: 403, statusText: 'Forbidden' },
      );
    await expect(read).rejects.toBeInstanceOf(ApiError);
  });
});
