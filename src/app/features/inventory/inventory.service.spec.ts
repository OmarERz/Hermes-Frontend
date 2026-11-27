import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import {
  DETAIL,
  INSTALLED_OPENSSL,
  KERNEL,
  OPENSSL,
  PAYMENTS,
  PENDING,
  SUMMARY,
  testConfig,
} from './inventory.fixtures';
import { InventoryService, MAX_CATALOGUE_PAGES } from './inventory.service';

const API = 'http://127.0.0.1:8000';

describe('InventoryService', () => {
  let service: InventoryService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: testConfig() },
      ],
    });
    service = TestBed.inject(InventoryService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('asks for a page of assets with the filters, the cursor and the page size', async () => {
    const result = firstValueFrom(
      service.listAssets({ q: 'pagos', criticality: 'high', exposed: null }, 'abc.def', 25),
    );
    const request = backend.expectOne((req) => req.url === `${API}/api/inventory/assets`);
    expect(request.request.params.get('q')).toBe('pagos');
    expect(request.request.params.get('criticality')).toBe('high');
    expect(request.request.params.has('exposed')).toBe(false);
    expect(request.request.params.get('cursor')).toBe('abc.def');
    expect(request.request.params.get('limit')).toBe('25');
    request.flush({ items: [PAYMENTS], next_cursor: 'n.sig' });
    expect(await result).toEqual({ items: [PAYMENTS], nextCursor: 'n.sig' });
  });

  it('counts the vulnerability groups per priority from the criticality view', async () => {
    const counts = firstValueFrom(service.vulnerabilityCounts());
    const request = backend.expectOne((req) => req.url === `${API}/api/vulnerabilities`);
    expect(request.request.params.get('view')).toBe('criticality');
    expect(request.request.params.get('limit')).toBe('1');
    request.flush({ view: 'criticality', bands: [{ level: 'critical', count: 3, groups: [] }] });
    expect(await counts).toEqual({ critical: 3, high: 0, medium: 0, low: 0 });

    const none = firstValueFrom(service.vulnerabilityCounts());
    backend.expectOne(() => true).flush({ view: 'criticality' });
    expect(await none).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });

  it('reads the summary, the asset detail, its software and the pending items', async () => {
    const summary = firstValueFrom(service.summary());
    backend.expectOne(`${API}/api/inventory/summary`).flush(SUMMARY);
    expect(await summary).toEqual(SUMMARY);

    const detail = firstValueFrom(service.asset('CI 1/x'));
    backend.expectOne(`${API}/api/assets/CI%201%2Fx`).flush(DETAIL);
    expect(await detail).toEqual(DETAIL);

    const software = firstValueFrom(service.assetSoftware('CI-1'));
    backend.expectOne(`${API}/api/inventory/assets/CI-1/software`).flush([INSTALLED_OPENSSL]);
    expect(await software).toEqual([INSTALLED_OPENSSL]);

    const pending = firstValueFrom(service.pending());
    backend.expectOne(`${API}/api/pending/inventory`).flush(PENDING);
    expect(await pending).toEqual(PENDING);
  });

  it('asks for a page of software with the category filter', async () => {
    const result = firstValueFrom(
      service.listSoftware({ category: 'WebServer', has_cpe: false }, null, 50),
    );
    const request = backend.expectOne((req) => req.url === `${API}/api/inventory/software`);
    expect(request.request.params.get('category')).toBe('WebServer');
    expect(request.request.params.get('has_cpe')).toBe('false');
    expect(request.request.params.has('cursor')).toBe(false);
    request.flush({ items: [OPENSSL] });
    expect(await result).toEqual({ items: [OPENSSL], nextCursor: null });
  });

  it('reads every page of the catalogue for its totals', async () => {
    const result = firstValueFrom(service.catalogue());
    const first = backend.expectOne((req) => req.url === `${API}/api/inventory/software`);
    expect(first.request.params.get('limit')).toBe('200');
    first.flush({ items: [OPENSSL], next_cursor: 'p2.sig' });
    const second = backend.expectOne((req) => req.params.get('cursor') === 'p2.sig');
    second.flush({ items: [KERNEL], next_cursor: null });
    expect(await result).toEqual({ items: [OPENSSL, KERNEL], complete: true });
  });

  it('stops at the page cap and says the catalogue is incomplete', async () => {
    const result = firstValueFrom(service.catalogue());
    for (let page = 1; page <= MAX_CATALOGUE_PAGES; page += 1) {
      backend
        .expectOne((req) => req.url === `${API}/api/inventory/software`)
        .flush({ items: [OPENSSL], next_cursor: `p${page + 1}.sig` });
    }
    const catalogue = await result;
    expect(catalogue.items).toHaveLength(MAX_CATALOGUE_PAGES);
    expect(catalogue.complete).toBe(false);
  });

  it('searches CPE candidates and saves a mapping by the software id', async () => {
    const candidates = firstValueFrom(service.cpeCandidates('open ssl'));
    const search = backend.expectOne((req) => req.url === `${API}/api/cpe/candidates`);
    expect(search.request.params.get('q')).toBe('open ssl');
    search.flush([{ cpe: OPENSSL.cpe, title: 'OpenSSL', score: 0.9 }]);
    expect((await candidates)[0]?.title).toBe('OpenSSL');

    const saved = firstValueFrom(service.setMapping(KERNEL.id, 'cpe:2.3:o:amazon:linux:*'));
    const put = backend.expectOne(`${API}/api/mappings/${KERNEL.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ cpe: 'cpe:2.3:o:amazon:linux:*' });
    put.flush({ software: KERNEL.id, cpe: 'cpe:2.3:o:amazon:linux:*' });
    expect((await saved).software).toBe(KERNEL.id);
  });
});
