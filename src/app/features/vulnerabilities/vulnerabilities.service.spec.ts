import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { VulnerabilityGroup } from '../../core/api/api-types';
import { APP_CONFIG } from '../../core/config/app-config';
import { VulnerabilitiesService } from './vulnerabilities.service';

const GROUP: VulnerabilityGroup = {
  group_id: '7d9f2b1e-0c3a-4f5e-9b8d-1a2b3c4d5e6f',
  cve: 'CVE-2024-3094',
  product: 'xz-utils 5.6.0',
  ci_count: 3,
  custodians: ['Plataforma'],
  tickets: ['R-000123'],
  final: 92,
  level: 'critical',
  in_kev: true,
  owners: ['Ana'],
  classification: 'classified',
  exposed: true,
  status: 'new',
  last_seen: '2026-11-20T15:30:00Z',
};

describe('VulnerabilitiesService', () => {
  let service: VulnerabilitiesService;
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
            apiBaseUrl: 'http://127.0.0.1:8000',
            firebase: null,
            authEmulatorUrl: null,
          },
        },
      ],
    });
    service = TestBed.inject(VulnerabilitiesService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('asks for the vulnerability view with the filters, cursor and page size', async () => {
    const result = firstValueFrom(
      service.listGroups(
        { band: 'critical', in_kev: true, status: null, exposed: null },
        'abc.def',
        25,
      ),
    );
    const request = backend.expectOne((req) => req.url.endsWith('/api/vulnerabilities'));
    const params = request.request.params;
    expect(params.get('view')).toBe('vulnerability');
    expect(params.get('band')).toBe('critical');
    expect(params.get('in_kev')).toBe('true');
    expect(params.get('cursor')).toBe('abc.def');
    expect(params.get('limit')).toBe('25');
    expect(params.has('status')).toBe(false);
    request.flush({ view: 'vulnerability', groups: [GROUP], next_cursor: 'next.sig' });
    await expect(result).resolves.toEqual({ items: [GROUP], nextCursor: 'next.sig' });
  });

  it('treats a page without groups as empty and the last page as having no cursor', async () => {
    const result = firstValueFrom(service.listGroups({}, null, 10));
    const request = backend.expectOne((req) => req.url.endsWith('/api/vulnerabilities'));
    expect(request.request.params.has('cursor')).toBe(false);
    request.flush({ view: 'vulnerability', groups: null, next_cursor: null });
    await expect(result).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('counts the groups of each level from the criticality view', async () => {
    const result = firstValueFrom(service.levelCounts({ exposed: true }));
    const request = backend.expectOne((req) => req.url.endsWith('/api/vulnerabilities'));
    expect(request.request.params.get('view')).toBe('criticality');
    expect(request.request.params.get('exposed')).toBe('true');
    request.flush({
      view: 'criticality',
      bands: [
        { level: 'critical', count: 4, groups: [GROUP] },
        { level: 'low', count: 9, groups: [] },
      ],
      next_cursor: null,
    });
    await expect(result).resolves.toEqual({ critical: 4, high: 0, medium: 0, low: 9 });
  });

  it('asks for the asset view and maps its assets', async () => {
    const result = firstValueFrom(service.listAssets({ exposed: true }, null, 10));
    const request = backend.expectOne((req) => req.url.endsWith('/api/vulnerabilities'));
    expect(request.request.params.get('view')).toBe('asset');
    expect(request.request.params.get('exposed')).toBe('true');
    request.flush({ view: 'asset', assets: [{ ci_id: 'SRV-01' }], next_cursor: 'n.s' });
    await expect(result).resolves.toEqual({ items: [{ ci_id: 'SRV-01' }], nextCursor: 'n.s' });
  });

  it('asks for the criticality view and maps its bands', async () => {
    const result = firstValueFrom(service.listBands({}, 'c.s', 25));
    const request = backend.expectOne((req) => req.url.endsWith('/api/vulnerabilities'));
    expect(request.request.params.get('view')).toBe('criticality');
    expect(request.request.params.get('cursor')).toBe('c.s');
    request.flush({ view: 'criticality', bands: null, next_cursor: null });
    await expect(result).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('reads the detail and the score history by id', async () => {
    const detail = firstValueFrom(service.getDetail('g-1'));
    backend.expectOne('http://127.0.0.1:8000/api/vulnerabilities/g-1').flush({ group_id: 'g-1' });
    await expect(detail).resolves.toMatchObject({ group_id: 'g-1' });
    const history = firstValueFrom(service.getHistory('f-1'));
    backend.expectOne('http://127.0.0.1:8000/api/findings/f-1/history').flush([]);
    await expect(history).resolves.toEqual([]);
  });

  it('takes the waterfall from the latest assessment of the group that scored the asset', async () => {
    const result = firstValueFrom(service.getLatestBreakdown('g-1', 'SRV-01'));
    const recommendations = backend.expectOne((req) => req.url.endsWith('/api/recommendations'));
    expect(recommendations.request.params.get('group_id')).toBe('g-1');
    // A newer assessment of the group may have scored only other CIs: ask for the latest one of this CI.
    expect(recommendations.request.params.get('ci_id')).toBe('SRV-01');
    expect(recommendations.request.params.get('limit')).toBe('1');
    recommendations.flush({ items: [{ assessment_id: 'a-9' }], next_cursor: null });
    const breakdown = backend.expectOne((req) =>
      req.url.endsWith('/api/assessments/a-9/breakdown'),
    );
    expect(breakdown.request.params.get('ci_id')).toBe('SRV-01');
    breakdown.flush({ assessment_id: 'a-9', raw: 50, final: 60, waterfall: { P: 10 } });
    await expect(result).resolves.toMatchObject({ assessment_id: 'a-9', final: 60 });
  });

  it('has no waterfall when the group has no assessment yet', async () => {
    const result = firstValueFrom(service.getLatestBreakdown('g-1', 'SRV-01'));
    backend
      .expectOne((req) => req.url.endsWith('/api/recommendations'))
      .flush({ items: [], next_cursor: null });
    await expect(result).resolves.toBeNull();
  });
});
