import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { APP_CONFIG } from '../../core/config/app-config';
import { BANDS, FEEDBACK_ENTRY, RECOMMENDATION } from './recommendation.fixtures';
import { RecommendationsService } from './recommendations.service';

const API = 'http://127.0.0.1:8000';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
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
    service = TestBed.inject(RecommendationsService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists one page with the scope, the cursor and the size', async () => {
    const page = firstValueFrom(service.list({ group_id: 'g-1' }, 'n.sig', 50));
    const request = backend.expectOne((req) => req.url === `${API}/api/recommendations`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('group_id')).toBe('g-1');
    expect(request.request.params.get('cursor')).toBe('n.sig');
    expect(request.request.params.get('limit')).toBe('50');
    expect(request.request.params.has('ci_id')).toBe(false);
    request.flush({ items: [RECOMMENDATION], next_cursor: null });
    await expect(page).resolves.toEqual({ items: [RECOMMENDATION], nextCursor: null });
  });

  it('reads one recommendation and its feedback by id', async () => {
    const one = firstValueFrom(service.get(RECOMMENDATION.assessment_id));
    backend
      .expectOne(`${API}/api/recommendations/${RECOMMENDATION.assessment_id}`)
      .flush(RECOMMENDATION);
    await expect(one).resolves.toEqual(RECOMMENDATION);

    const history = firstValueFrom(service.feedback(RECOMMENDATION.assessment_id));
    backend
      .expectOne(`${API}/api/recommendations/${RECOMMENDATION.assessment_id}/feedback`)
      .flush([FEEDBACK_ENTRY]);
    await expect(history).resolves.toEqual([FEEDBACK_ENTRY]);
  });

  it('posts the feedback body as is and maps a 403 to its Spanish message', async () => {
    const body = { assessment_id: RECOMMENDATION.assessment_id, verdict: 'relevant' as const };
    const saved = firstValueFrom(service.send(body));
    const request = backend.expectOne(`${API}/api/feedback`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(
      { feedback_id: '0192f3a5-1c2d-7e3f-9a4b-5c6d7e8f9a0b', replaced_previous: true },
      { status: 201, statusText: 'Created' },
    );
    await expect(saved).resolves.toEqual(expect.objectContaining({ replaced_previous: true }));

    const denied = firstValueFrom(service.send(body)).catch((error: unknown) => error);
    backend
      .expectOne(`${API}/api/feedback`)
      .flush(
        { error: { code: 'forbidden', message: 'No tienes permiso.', details: [] } },
        { status: 403, statusText: 'Forbidden' },
      );
    const error = (await denied) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('No tienes permiso.');
  });

  it('reads the level bands from the configuration', async () => {
    const bands = firstValueFrom(service.levelBands());
    backend.expectOne(`${API}/api/config`).flush({
      version: 3,
      values: { 'bands.1': '90', 'bands.2': '75', 'bands.3': '50', 'bands.4': '0', dead_zone: '4' },
    });
    await expect(bands).resolves.toEqual(BANDS);
  });
});
