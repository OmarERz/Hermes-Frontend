import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { HomeService } from './home.service';

describe('HomeService', () => {
  let service: HomeService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://127.0.0.1:8000' } },
      ],
    });
    service = TestBed.inject(HomeService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('reads the inventory summary', async () => {
    const result = firstValueFrom(service.inventorySummary());
    backend.expectOne('http://127.0.0.1:8000/api/inventory/summary').flush({ total_assets: 3 });
    await expect(result).resolves.toEqual({ total_assets: 3 });
  });

  it('reads the ticket summary', async () => {
    const result = firstValueFrom(service.ticketSummary());
    backend.expectOne('http://127.0.0.1:8000/api/tickets/summary').flush({ total: 4 });
    await expect(result).resolves.toEqual({ total: 4 });
  });

  it('reads the telemetry of the last 7 days', async () => {
    const result = firstValueFrom(service.telemetrySummary());
    const request = backend.expectOne((req) => req.url.endsWith('/api/telemetry/summary'));
    expect(request.request.params.get('window')).toBe('7d');
    request.flush({ window: '7d' });
    await expect(result).resolves.toEqual({ window: '7d' });
  });
});
