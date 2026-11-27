import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { ComparisonService } from './comparison.service';

describe('ComparisonService', () => {
  let service: ComparisonService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://127.0.0.1:8000' } },
      ],
    });
    service = TestBed.inject(ComparisonService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('reads the summary', async () => {
    const result = firstValueFrom(service.summary());
    backend
      .expectOne('http://127.0.0.1:8000/api/comparison/summary')
      .flush({ hidden_criticals: 1 });
    await expect(result).resolves.toMatchObject({ hidden_criticals: 1 });
  });

  it('pages the table with the cursor as received', async () => {
    const result = firstValueFrom(service.rows('a.b', 25));
    const request = backend.expectOne((req) => req.url.endsWith('/api/comparison/table'));
    expect(request.request.params.get('cursor')).toBe('a.b');
    expect(request.request.params.get('limit')).toBe('25');
    request.flush({ items: [], next_cursor: null });
    await expect(result).resolves.toEqual({ items: [], nextCursor: null });
  });
});
