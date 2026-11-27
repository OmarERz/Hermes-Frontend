import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { APP_CONFIG } from '../../core/config/app-config';
import { Run, SetupService } from './setup.service';

const API = 'http://127.0.0.1:8000';
const STEP = { n: 2, name: 'Perfil de la empresa', done: false, skipped: true };
const RUN: Run = {
  id: '0b6c0a8e-3c9f-4a3e-9d7a-2d1f4a8b6c11',
  kind: 'scan',
  status: 'queued',
  started_at: '2026-11-27T06:00:00Z',
  finished_at: null,
  progress: 0,
};

describe('SetupService', () => {
  let service: SetupService;
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
    service = TestBed.inject(SetupService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('reads the steps and marks one', async () => {
    const read = firstValueFrom(service.status());
    const status = backend.expectOne(`${API}/api/setup/status`);
    expect(status.request.method).toBe('GET');
    status.flush([STEP]);
    expect(await read).toEqual([STEP]);

    const marked = firstValueFrom(service.mark(2, { done: false, skipped: true }));
    const mark = backend.expectOne(`${API}/api/setup/steps/2`);
    expect(mark.request.method).toBe('PUT');
    expect(mark.request.body).toEqual({ done: false, skipped: true });
    mark.flush(STEP);
    expect(await marked).toEqual(STEP);
  });

  it('reads the inventory pendings', async () => {
    const pending = firstValueFrom(service.pendingInventory());
    backend.expectOne(`${API}/api/pending/inventory`).flush({ software_without_cpe: [] });
    expect(await pending).toEqual({ software_without_cpe: [] });
  });

  it('launches a scan, reads the latest scans and reads one run by its id', async () => {
    const launched = firstValueFrom(service.launchScan());
    const launch = backend.expectOne(`${API}/api/scans`);
    expect(launch.request.method).toBe('POST');
    expect(launch.request.body).toEqual({ kind: 'scan' });
    launch.flush(RUN);
    expect(await launched).toEqual(RUN);

    const scans = firstValueFrom(service.scans(20));
    const list = backend.expectOne(`${API}/api/runs?kind=scan&limit=20`);
    expect(list.request.method).toBe('GET');
    list.flush({ items: [RUN], next_cursor: null });
    expect(await scans).toEqual([RUN]);

    const one = firstValueFrom(service.run(RUN.id));
    const read = backend.expectOne(`${API}/api/runs/${RUN.id}`);
    expect(read.request.method).toBe('GET');
    read.flush({ ...RUN, status: 'succeeded', progress: 100 });
    expect(await one).toEqual({ ...RUN, status: 'succeeded', progress: 100 });
  });

  it('hands the API refusal over as an ApiError', async () => {
    const read = firstValueFrom(service.mark(9, { done: true, skipped: false }));
    backend
      .expectOne(`${API}/api/setup/steps/9`)
      .flush(
        { error: { code: 'not_found', message: 'El paso del asistente no existe.' } },
        { status: 404, statusText: 'Not Found' },
      );
    await expect(read).rejects.toBeInstanceOf(ApiError);
  });
});
