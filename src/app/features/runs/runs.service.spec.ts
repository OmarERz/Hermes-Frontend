import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { RunsService } from './runs.service';
import { NEWS_DONE, SCAN_RUNNING, SUMMARY } from './runs.fixtures';

describe('RunsService', () => {
  let service: RunsService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://127.0.0.1:8000' } },
      ],
    });
    service = TestBed.inject(RunsService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists runs with the filters and the cursor as received', async () => {
    const result = firstValueFrom(
      service.list(
        {
          kind: 'scan',
          status: 'failed',
          date_from: '2026-11-20T06:00:00.000Z',
          date_to: null,
        },
        'a.b',
        25,
      ),
    );
    const request = backend.expectOne((req) => req.url === 'http://127.0.0.1:8000/api/runs');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('kind')).toBe('scan');
    expect(request.request.params.get('status')).toBe('failed');
    expect(request.request.params.get('date_from')).toBe('2026-11-20T06:00:00.000Z');
    expect(request.request.params.has('date_to')).toBe(false);
    expect(request.request.params.get('cursor')).toBe('a.b');
    expect(request.request.params.get('limit')).toBe('25');
    request.flush({ items: [NEWS_DONE], next_cursor: 'c.d' });
    await expect(result).resolves.toEqual({ items: [NEWS_DONE], nextCursor: 'c.d' });
  });

  it('sends only the page size without filters', async () => {
    const result = firstValueFrom(service.list({}, null, 25));
    const request = backend.expectOne((req) => req.url.endsWith('/api/runs'));
    expect(request.request.params.keys()).toEqual(['limit']);
    request.flush({ items: [] });
    await expect(result).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('queues a scan', async () => {
    const result = firstValueFrom(service.launchScan());
    const request = backend.expectOne((req) => req.url.endsWith('/api/scans'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ kind: 'scan' });
    request.flush(
      { ...SCAN_RUNNING, status: 'queued', progress: 0 },
      { status: 202, statusText: 'Accepted' },
    );
    await expect(result).resolves.toMatchObject({ id: SCAN_RUNNING.id, status: 'queued' });
  });

  it('reads the run counts of the last 24 hours', async () => {
    const result = firstValueFrom(service.summary());
    const request = backend.expectOne((req) => req.url.endsWith('/api/telemetry/summary'));
    expect(request.request.params.get('window')).toBe('24h');
    request.flush(SUMMARY);
    await expect(result).resolves.toEqual(SUMMARY);
  });
});
