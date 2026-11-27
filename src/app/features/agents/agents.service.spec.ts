import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { LATEST_RUN, LLM_REVIEW } from './agents.fixtures';
import { AgentsService } from './agents.service';

const API = 'http://127.0.0.1:8000';

describe('AgentsService', () => {
  let service: AgentsService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: API } },
      ],
    });
    service = TestBed.inject(AgentsService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('reads the telemetry summary of a window', async () => {
    const result = firstValueFrom(service.summary('30d'));
    const request = backend.expectOne((req) => req.url === `${API}/api/telemetry/summary`);
    expect(request.request.params.get('window')).toBe('30d');
    request.flush({ window: '30d' });
    await expect(result).resolves.toEqual({ window: '30d' });
  });

  it('reads the daily series of a number of days', async () => {
    const result = firstValueFrom(service.daily(7));
    const request = backend.expectOne((req) => req.url === `${API}/api/telemetry/daily`);
    expect(request.request.params.get('days')).toBe('7');
    request.flush({ days: 7, series: [] });
    await expect(result).resolves.toEqual({ days: 7, series: [] });
  });

  it('pages the review log with its filters and the cursor as received', async () => {
    const result = firstValueFrom(
      service.reviews(
        { agent: 'judge', status: null, date_from: '2026-11-01T06:00:00.000Z', date_to: null },
        'a.b',
        25,
      ),
    );
    const request = backend.expectOne((req) => req.url === `${API}/api/telemetry/reviews`);
    expect(request.request.params.get('agent')).toBe('judge');
    expect(request.request.params.get('date_from')).toBe('2026-11-01T06:00:00.000Z');
    expect(request.request.params.has('status')).toBe(false);
    expect(request.request.params.get('cursor')).toBe('a.b');
    expect(request.request.params.get('limit')).toBe('25');
    request.flush({ items: [LLM_REVIEW], next_cursor: 'c.d' });
    await expect(result).resolves.toEqual({ items: [LLM_REVIEW], nextCursor: 'c.d' });
  });

  it('treats a page without a next cursor as the last one', async () => {
    const result = firstValueFrom(service.reviews({}, null, 25));
    backend.expectOne((req) => req.url.endsWith('/api/telemetry/reviews')).flush({ items: [] });
    await expect(result).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('reads the ticket summary', async () => {
    const result = firstValueFrom(service.ticketSummary());
    backend.expectOne(`${API}/api/tickets/summary`).flush({ total: 2 });
    await expect(result).resolves.toEqual({ total: 2 });
  });

  it('reads the first run the API lists, or null without runs', async () => {
    let result = firstValueFrom(service.latestRun());
    let request = backend.expectOne((req) => req.url === `${API}/api/runs`);
    expect(request.request.params.get('limit')).toBe('1');
    request.flush({ items: [LATEST_RUN], next_cursor: null });
    await expect(result).resolves.toEqual(LATEST_RUN);

    result = firstValueFrom(service.latestRun());
    request = backend.expectOne((req) => req.url === `${API}/api/runs`);
    request.flush({ items: [], next_cursor: null });
    await expect(result).resolves.toBeNull();
  });

  it('reads the metrics board', async () => {
    const result = firstValueFrom(service.metrics());
    backend.expectOne(`${API}/api/metrics`).flush({ generated_at: 'x', metrics: [] });
    await expect(result).resolves.toEqual({ generated_at: 'x', metrics: [] });
  });
});
