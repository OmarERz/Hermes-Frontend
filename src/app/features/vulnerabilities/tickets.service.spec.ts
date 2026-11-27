import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://127.0.0.1:8000' } },
      ],
    });
    service = TestBed.inject(TicketsService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists tickets of one urgency with the cursor as received', async () => {
    const result = firstValueFrom(service.listTickets(1, 'a.b', 25));
    const request = backend.expectOne((req) => req.url === 'http://127.0.0.1:8000/api/tickets');
    expect(request.request.params.get('urgency')).toBe('1');
    expect(request.request.params.get('cursor')).toBe('a.b');
    request.flush({ items: [{ itop_id: '12' }], next_cursor: 'c.d' });
    await expect(result).resolves.toEqual({ items: [{ itop_id: '12' }], nextCursor: 'c.d' });
  });

  it('lists every urgency when there is no filter', async () => {
    const result = firstValueFrom(service.listTickets(null, null, 25));
    const request = backend.expectOne((req) => req.url.endsWith('/api/tickets'));
    expect(request.request.params.keys()).toEqual(['limit']);
    request.flush({ items: [], next_cursor: null });
    await expect(result).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('lists threat alerts', async () => {
    const result = firstValueFrom(service.listAlerts(null, 25));
    backend
      .expectOne((req) => req.url.endsWith('/api/alerts'))
      .flush({ items: [{ id: 'al-1' }], next_cursor: null });
    await expect(result).resolves.toEqual({ items: [{ id: 'al-1' }], nextCursor: null });
  });
});
