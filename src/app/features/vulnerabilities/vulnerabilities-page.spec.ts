import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { VulnerabilityGroup } from '../../core/api/api-types';
import type { CursorPage } from '../../shared/cursor-pager';
import { VulnerabilitiesPage } from './vulnerabilities-page';
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

class FakeService {
  listGroups = vi.fn<VulnerabilitiesService['listGroups']>(() =>
    of({ items: [GROUP], nextCursor: 'n.sig' }),
  );
  levelCounts = vi.fn<VulnerabilitiesService['levelCounts']>(() =>
    of({ critical: 1, high: 0, medium: 2, low: 0 }),
  );
}

async function render(service: FakeService) {
  TestBed.configureTestingModule({
    imports: [VulnerabilitiesPage],
    providers: [{ provide: VulnerabilitiesService, useValue: service }],
  });
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
    expect(service.listGroups).toHaveBeenCalledWith(
      { band: null, status: null, in_kev: null, exposed: null },
      null,
      25,
    );
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
      { band: 'critical', status: null, in_kev: null, exposed: null },
      null,
      25,
    );
    expect(fixture.componentInstance.pager.pageIndex()).toBe(0);
  });

  it('asks for the level counts again with the new filters', async () => {
    const service = new FakeService();
    const { fixture } = await render(service);
    fixture.componentInstance.setInKev('true');
    await fixture.whenStable();
    expect(service.levelCounts).toHaveBeenLastCalledWith({
      band: null,
      status: null,
      in_kev: true,
      exposed: null,
    });
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
});
