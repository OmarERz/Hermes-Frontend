import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideRouter, Router } from '@angular/router';
import type { AssetRisk, VulnerabilityGroup } from './vulnerabilities.service';
import type { CursorPage } from '../../shared/cursor-pager';
import { VulnerabilitiesPage } from './vulnerabilities.page';
import { VulnerabilitiesService } from './vulnerabilities.service';
import { provideFakeSession } from '../../testing/fake-session';

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

/** Every filter empty: what the page asks for before the person picks one. */
const NO_FILTERS = {
  band: null,
  status: null,
  in_kev: null,
  exposed: null,
  classification: null,
  owner: null,
  custodian: null,
  date_from: null,
  date_to: null,
};

class FakeService {
  listGroups = vi.fn<VulnerabilitiesService['listGroups']>(() =>
    of({ items: [GROUP], nextCursor: 'n.sig' }),
  );
  levelCounts = vi.fn<VulnerabilitiesService['levelCounts']>(() =>
    of({ critical: 1, high: 0, medium: 2, low: 0 }),
  );
  listAssets = vi.fn<VulnerabilitiesService['listAssets']>(() =>
    of({ items: [ASSET], nextCursor: null }),
  );
  listBands = vi.fn<VulnerabilitiesService['listBands']>(() =>
    of({
      items: [
        { level: 'critical', count: 4, groups: [GROUP] },
        { level: 'low', count: 9, groups: [] },
      ],
      nextCursor: null,
    }),
  );
}

const ASSET: AssetRisk = {
  ci_id: 'SRV-01',
  name: 'Servidor de pagos',
  risk: 92,
  findings_by_level: { critical: 2, low: 1 },
  in_kev: 1,
  classification: 'highly_classified',
  owner: 'Ana',
  custodian: 'Plataforma',
  exposed: true,
  status: 'persistent',
  last_seen: '2026-11-20T15:30:00Z',
};

async function render(service: FakeService, url = '/vulnerabilidades') {
  TestBed.configureTestingModule({
    imports: [VulnerabilitiesPage],
    providers: [
      { provide: VulnerabilitiesService, useValue: service },
      ...provideFakeSession(),
      provideRouter([{ path: 'vulnerabilidades', component: VulnerabilitiesPage }]),
    ],
  });
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(VulnerabilitiesPage);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('VulnerabilitiesPage', () => {
  it('shows one row per group with Spanish labels and the level counts', async () => {
    const service = new FakeService();
    const { element } = await render(service);
    const cells = Array.from(element.querySelectorAll('tbody tr td')).map((td) =>
      td.textContent?.trim(),
    );
    expect(cells.slice(0, 9)).toEqual([
      'CVE-2024-3094',
      'xz-utils 5.6.0',
      'Crítica',
      '92',
      '3',
      'Sí',
      'Sí',
      'Clasificada',
      'Nuevo',
    ]);
    const cards = Array.from(element.querySelectorAll('.stat-card strong')).map((s) =>
      s.textContent?.trim(),
    );
    expect(cards).toEqual(['1', '0', '2', '0']);
    expect(service.listGroups).toHaveBeenCalledWith(NO_FILTERS, null, 25);
  });

  it('pages forward with the cursor of the response and resets it when a filter changes', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    (element.querySelector('[aria-label="Página siguiente"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.listGroups).toHaveBeenLastCalledWith(expect.anything(), 'n.sig', 25);

    fixture.componentInstance.setBand('critical');
    await fixture.whenStable();
    expect(service.listGroups).toHaveBeenLastCalledWith(
      { ...NO_FILTERS, band: 'critical' },
      null,
      25,
    );
    expect(fixture.componentInstance.pager().pageIndex()).toBe(0);
  });

  it('asks for the level counts again with the new filters', async () => {
    const service = new FakeService();
    const { fixture } = await render(service);
    fixture.componentInstance.setInKev('true');
    await fixture.whenStable();
    expect(service.levelCounts).toHaveBeenLastCalledWith({ ...NO_FILTERS, in_kev: true });
  });

  it('never shows the counts of other filters while loading or after an error', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    const cards = () =>
      Array.from(element.querySelectorAll('.stat-card strong')).map((s) => s.textContent?.trim());
    expect(cards()).toEqual(['1', '0', '2', '0']);

    const pending = new Subject<{ critical: number; high: number; medium: number; low: number }>();
    service.levelCounts.mockReturnValueOnce(pending);
    fixture.componentInstance.setExposed('true');
    await fixture.whenStable();
    expect(cards()).toEqual(['Cargando…', 'Cargando…', 'Cargando…', 'Cargando…']);

    pending.error(new ApiError(503, 'auth_unavailable', 'No responde.'));
    await fixture.whenStable();
    expect(cards()).toEqual(['Sin datos', 'Sin datos', 'Sin datos', 'Sin datos']);
  });

  it('shows the loading state, then the empty state with filters', async () => {
    const service = new FakeService();
    const pending = new Subject<CursorPage<VulnerabilityGroup>>();
    service.listGroups.mockReturnValue(pending);
    const { fixture, element } = await render(service);
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Cargando vulnerabilidades',
    );
    pending.next({ items: [], nextCursor: null });
    await fixture.whenStable();
    expect(element.textContent).toContain('Aún no hay vulnerabilidades registradas.');
  });

  it('shows the API message and retries on an error', async () => {
    const service = new FakeService();
    service.listGroups.mockReturnValueOnce(
      throwError(
        () => new ApiError(503, 'auth_unavailable', 'El servicio de identidad no responde.'),
      ),
    );
    const { fixture, element } = await render(service);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'El servicio de identidad no responde.',
    );
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('links each group to its detail', async () => {
    const { element } = await render(new FakeService());
    const link = element.querySelector('tbody a.row-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(`/vulnerabilidades/${GROUP.group_id}`);
  });

  it('switches to the asset view with its own cursor and keeps it in the URL', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    const assetButton = Array.from(element.querySelectorAll('.view-switch button')).find((button) =>
      button.textContent?.includes('Por activo'),
    ) as HTMLButtonElement;
    assetButton.click();
    await fixture.whenStable();
    expect(service.listAssets).toHaveBeenCalledWith(NO_FILTERS, null, 25);
    expect(TestBed.inject(Router).url).toBe('/vulnerabilidades?vista=activo');
    const cells = Array.from(element.querySelectorAll('tbody tr td')).map((td) =>
      td.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(cells[0]).toContain('Servidor de pagos');
    expect(cells[0]).toContain('SRV-01');
    expect(cells[1]).toBe('92');
    expect(cells[2]).toBe('Crítica: 2Baja: 1');
    expect(element.querySelector('tbody a.row-link')?.getAttribute('href')).toBe('/activos/SRV-01');
  });

  it('follows the view of the URL when the page is reused (section tab, back button)', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service, '/vulnerabilidades?vista=activo');
    expect(fixture.componentInstance.view()).toBe('asset');
    expect(service.listGroups).not.toHaveBeenCalled();

    await TestBed.inject(Router).navigateByUrl('/vulnerabilidades');
    await fixture.whenStable();
    expect(fixture.componentInstance.view()).toBe('vulnerability');
    expect(service.listGroups).toHaveBeenCalledWith(NO_FILTERS, null, 25);
    expect(element.querySelector('tbody a.row-link')?.getAttribute('href')).toBe(
      `/vulnerabilidades/${GROUP.group_id}`,
    );

    await TestBed.inject(Router).navigateByUrl('/vulnerabilidades?vista=criticidad');
    await fixture.whenStable();
    expect(fixture.componentInstance.view()).toBe('criticality');
    expect(service.listBands).toHaveBeenCalledTimes(1);
  });

  it('opens the criticality view from the URL with a header row per band', async () => {
    const service = new FakeService();
    const { element } = await render(service, '/vulnerabilidades?vista=criticidad');
    expect(service.listBands).toHaveBeenCalled();
    expect(service.listGroups).not.toHaveBeenCalled();
    const bands = Array.from(element.querySelectorAll('tr.band-row')).map((row) =>
      row.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(bands).toEqual(['Crítica 4 grupos en total', 'Baja 9 grupos en total']);
    expect(element.querySelectorAll('tbody tr:not(.band-row)').length).toBe(1);
  });

  it('applies each filter from the first page and clears them all', async () => {
    const service = new FakeService();
    const { fixture } = await render(service);
    const page = fixture.componentInstance;
    page.setStatus('new');
    page.setExposed('false');
    page.setInKev('true');
    expect(service.listGroups).toHaveBeenLastCalledWith(
      { ...NO_FILTERS, status: 'new', in_kev: true, exposed: false },
      null,
      25,
    );
    expect(page.hasFilters()).toBe(true);
    page.clearFilters();
    expect(service.listGroups).toHaveBeenLastCalledWith(NO_FILTERS, null, 25);
    expect(service.levelCounts).toHaveBeenLastCalledWith(NO_FILTERS);
  });

  it('filters by classification, owner, custodian and the days of «Última vez vista» in every view', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service, '/vulnerabilidades?vista=activo');
    const page = fixture.componentInstance;
    page.setClassification('highly_classified');
    const owner = element.querySelector(
      '[aria-label="Responsable (texto exacto)"]',
    ) as HTMLInputElement;
    owner.value = '  Ana  ';
    owner.dispatchEvent(new Event('change'));
    const custodian = element.querySelector(
      '[aria-label="Custodio (texto exacto)"]',
    ) as HTMLInputElement;
    custodian.value = 'Plataforma';
    custodian.dispatchEvent(new Event('change'));
    page.setDateFrom('2026-11-01');
    page.setDateTo('2026-11-20');
    const expected = {
      ...NO_FILTERS,
      classification: 'highly_classified',
      owner: 'Ana',
      custodian: 'Plataforma',
      // Whole days in the person's time zone, both ends included.
      date_from: new Date(2026, 10, 1, 0, 0, 0, 0).toISOString(),
      date_to: new Date(2026, 10, 20, 23, 59, 59, 999).toISOString(),
    };
    expect(service.listAssets).toHaveBeenLastCalledWith(expected, null, 25);
    expect(service.levelCounts).toHaveBeenLastCalledWith(expected);

    page.setView('criticality');
    expect(service.listBands).toHaveBeenLastCalledWith(expected, null, 25);

    await fixture.whenStable();
    page.clearFilters();
    await fixture.whenStable();
    expect(service.listBands).toHaveBeenLastCalledWith(NO_FILTERS, null, 25);
    expect(owner.value).toBe('');
    expect(page.hasFilters()).toBe(false);
  });

  it('does not reload when a filter keeps its value and ignores a malformed day', async () => {
    const service = new FakeService();
    const { fixture } = await render(service);
    const page = fixture.componentInstance;
    const calls = service.listGroups.mock.calls.length;
    page.setOwner('   ');
    page.setStatus('');
    expect(service.listGroups.mock.calls.length).toBe(calls);
    page.setDateFrom('20-11-2026');
    expect(page.filters().date_from).toBeNull();
  });

  it('reloads the current view from the first page with a new page size', async () => {
    const service = new FakeService();
    const { fixture } = await render(service, '/vulnerabilidades?vista=activo');
    fixture.componentInstance.setPageSize(50);
    expect(service.listAssets).toHaveBeenLastCalledWith(NO_FILTERS, null, 50);
    fixture.componentInstance.setView('asset');
    expect(service.listAssets).toHaveBeenCalledTimes(2);
  });
});
