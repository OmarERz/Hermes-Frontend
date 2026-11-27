import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { downloadJson, StixService } from './stix.service';

describe('StixService', () => {
  let service: StixService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://127.0.0.1:8000' } },
      ],
    });
    service = TestBed.inject(StixService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('posts the export request and returns the bundle', async () => {
    const result = firstValueFrom(
      service.exportBundle({ scope: 'run', run_id: 'r-1', exclude_ultra_classified: true }),
    );
    const request = backend.expectOne('http://127.0.0.1:8000/api/stix/export');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      scope: 'run',
      run_id: 'r-1',
      exclude_ultra_classified: true,
    });
    request.flush({ type: 'bundle', id: 'bundle--1', objects: [] });
    await expect(result).resolves.toMatchObject({ id: 'bundle--1' });
  });

  it('downloads through downloadJson', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    service.download({ type: 'bundle', id: 'bundle--1', objects: [] }, 'b.json');
    expect(click).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('lists the runs page by page with the cursor of the API', async () => {
    const first = firstValueFrom(service.listRuns(null, 10));
    const request = backend.expectOne((req) => req.url.endsWith('/api/runs'));
    expect(request.request.params.get('limit')).toBe('10');
    expect(request.request.params.has('cursor')).toBe(false);
    request.flush({ items: [{ id: 'r-1' }], next_cursor: 'n.sig' });
    await expect(first).resolves.toEqual({ items: [{ id: 'r-1' }], nextCursor: 'n.sig' });

    const second = firstValueFrom(service.listRuns('n.sig', 10));
    const next = backend.expectOne((req) => req.url.endsWith('/api/runs'));
    expect(next.request.params.get('cursor')).toBe('n.sig');
    next.flush({ items: [{ id: 'r-0' }] });
    await expect(second).resolves.toEqual({ items: [{ id: 'r-0' }], nextCursor: null });
  });
});

describe('downloadJson', () => {
  it('saves the data as a JSON file and frees the object URL', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:hermes');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    downloadJson({ a: 1 }, 'bundle.json');
    expect(create).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:hermes');
    vi.restoreAllMocks();
  });
});
