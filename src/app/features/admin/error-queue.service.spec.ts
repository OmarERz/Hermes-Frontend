import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { ErrorQueueService } from './error-queue.service';

const EVENT_ID = '0196a6f0-0000-7000-8000-0000000000aa';

describe('ErrorQueueService', () => {
  let service: ErrorQueueService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://127.0.0.1:8000' } },
      ],
    });
    service = TestBed.inject(ErrorQueueService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists the failed items of one origin with the cursor as received', async () => {
    const result = firstValueFrom(service.list('itop', 'a.b', 50));
    const request = backend.expectOne((req) => req.url === 'http://127.0.0.1:8000/api/error-queue');
    expect(request.request.params.get('kind')).toBe('itop');
    expect(request.request.params.get('cursor')).toBe('a.b');
    expect(request.request.params.get('limit')).toBe('50');
    request.flush({ items: [{ id: 'x' }], next_cursor: 'c.d' });
    await expect(result).resolves.toEqual({ items: [{ id: 'x' }], nextCursor: 'c.d' });
  });

  it('lists every origin without a filter', async () => {
    const result = firstValueFrom(service.list(null, null, 50));
    const request = backend.expectOne((req) => req.url.endsWith('/api/error-queue'));
    expect(request.request.params.keys()).toEqual(['limit']);
    request.flush({ items: [], next_cursor: null });
    await expect(result).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('retries a notification event', async () => {
    const result = firstValueFrom(service.retry(EVENT_ID));
    const request = backend.expectOne(
      (req) => req.url === `http://127.0.0.1:8000/api/notifications/events/${EVENT_ID}/retry`,
    );
    expect(request.request.method).toBe('POST');
    request.flush({ id: EVENT_ID, status: 'pending' }, { status: 202, statusText: 'Accepted' });
    await expect(result).resolves.toMatchObject({ id: EVENT_ID, status: 'pending' });
  });
});
