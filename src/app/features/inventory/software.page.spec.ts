import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { APP_CONFIG } from '../../core/config/app-config';
import { GraficoDashboard } from '../../componentes/grafico-dashboard/grafico-dashboard';
import { provideFakeSession } from '../../testing/fake-session';
import { ChartStub } from './chart-stub.spec-helper';
import { CpeMappingDialog } from './cpe-mapping-dialog';
import { KERNEL, OPENSSL, SUMMARY, testConfig } from './inventory.fixtures';
import { InventoryService } from './inventory.service';
import { SoftwarePage } from './software.page';

const NO_FILTERS = {
  q: null,
  category: null,
  has_cpe: null,
  worst_level: null,
  with_vulnerabilities: null,
};

class FakeService {
  listSoftware = vi.fn<InventoryService['listSoftware']>(() =>
    of({ items: [OPENSSL, KERNEL], nextCursor: 'n.sig' }),
  );
  summary = vi.fn<InventoryService['summary']>(() => of(SUMMARY));
  catalogue = vi.fn<InventoryService['catalogue']>(() =>
    of({ items: [OPENSSL, KERNEL], complete: true }),
  );
  vulnerabilityCounts = vi.fn<InventoryService['vulnerabilityCounts']>(() =>
    of({ critical: 1, high: 0, medium: 0, low: 2 }),
  );
  cpeCandidates = vi.fn<InventoryService['cpeCandidates']>(() => of([]));
  setMapping = vi.fn<InventoryService['setMapping']>(() =>
    of({ software: KERNEL.id, cpe: 'cpe:2.3:o:amazon:linux_kernel:*:*:*:*:*:*:*:*' }),
  );
}

async function render(
  service = new FakeService(),
  role: Role = 'reader',
  itopBaseUrl: string | null = null,
) {
  TestBed.configureTestingModule({
    imports: [SoftwarePage],
    providers: [
      { provide: InventoryService, useValue: service },
      { provide: APP_CONFIG, useValue: testConfig(itopBaseUrl) },
      ...provideFakeSession(role),
    ],
  });
  TestBed.overrideComponent(SoftwarePage, {
    remove: { imports: [GraficoDashboard] },
    add: { imports: [ChartStub] },
  });
  const fixture = TestBed.createComponent(SoftwarePage);
  await fixture.whenStable();
  return {
    fixture,
    page: fixture.componentInstance,
    element: fixture.nativeElement as HTMLElement,
  };
}

function cells(element: HTMLElement): string[][] {
  return Array.from(element.querySelectorAll('tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('td')).map(
      (td) => td.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    ),
  );
}

describe('SoftwarePage', () => {
  it('lists the catalogue with categories, versions, statuses, licences, CPE and findings', async () => {
    const service = new FakeService();
    const { element } = await render(service);
    const [openssl, kernel] = cells(element);
    expect(openssl).toEqual([
      'OpenSSL',
      'Otro softwareServidor web',
      '3.0.7',
      '3 3 activos',
      'Activa: 1Inactiva: 1Sin dato: 1',
      '1 de 3Soporte OpenSSL',
      'cpe:2.3:a:openssl:openssl:*:*:*:*:*:*:*:*',
      'Crítica2 abiertas',
      '',
    ]);
    expect(kernel).toEqual([
      'Amazon Linux 2023 kernel',
      'Sin categoría',
      'Versión desconocida',
      '1 1 activo',
      'Sin dato: 1',
      '0 de 1Sin licencias',
      'Sin CPE',
      'Sin vulnerabilidades',
      '',
    ]);
    expect(service.listSoftware).toHaveBeenCalledWith(NO_FILTERS, null, 25);
    // N-3: the shared data table; the CPE only breaks after its colons, never inside a part.
    expect(element.querySelector('table')?.classList).toContain('data-table');
    expect(
      Array.from(element.querySelectorAll('tbody tr:first-child .cpe span')).map(
        (part) => part.textContent,
      ),
    ).toEqual([
      'cpe:',
      '2.3:',
      'a:',
      'openssl:',
      'openssl:',
      '*:',
      '*:',
      '*:',
      '*:',
      '*:',
      '*:',
      '*:',
      '*',
    ]);
    expect(element.querySelectorAll('tbody tr:first-child .cpe wbr')).toHaveLength(13);
    // N-8: the numbered pager of the other lists.
    expect(element.querySelector('.pagination button.selected')?.textContent?.trim()).toBe('1');
    // Readers never get the mapping action.
    expect(element.querySelector('.row-action')).toBeNull();
  });

  it('shows the summary cards and the catalogue totals', async () => {
    const { element } = await render();
    // N-5 (F19.8): the shared indicator cards.
    const cards = Array.from(element.querySelectorAll('.kpi-grid app-kpi-card')).map((card) =>
      card.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(cards).toEqual([
      'Software en inventario 3',
      'Con vulnerabilidades críticas 1',
      'Con CPE 3100.0 %',
      'Con versión conocida 3100.0 %',
    ]);
    const statuses = Array.from(element.querySelectorAll('.status-panel li')).map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(statuses).toEqual(['Activa1', 'Inactiva1', 'Sin dato2']);
    expect(element.querySelector('.license-panel header p')?.textContent).toContain(
      '1 de 4 instalaciones',
    );
    const licence = element.querySelector('.license-panel li')?.textContent?.replace(/\s+/g, ' ');
    expect(licence).toContain('Soporte OpenSSL');
    expect(licence).toContain('Límite: 10 servidores');
    expect(element.querySelector('app-grafico-dashboard')?.getAttribute('aria-label')).toBe(
      'Instalaciones por categoría del catálogo de software',
    );
  });

  it('filters by category and the other filters, starting again from the first page', async () => {
    const service = new FakeService();
    const { fixture, page, element } = await render(service);
    (element.querySelector('[aria-label="Página siguiente"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.listSoftware).toHaveBeenLastCalledWith(NO_FILTERS, 'n.sig', 25);

    page.setQuery(' ssl ');
    page.setCategory('WebServer');
    page.setHasCpe('true');
    page.setWorstLevel('critical');
    page.setWithVulnerabilities('true');
    await fixture.whenStable();
    expect(service.listSoftware).toHaveBeenLastCalledWith(
      {
        q: 'ssl',
        category: 'WebServer',
        has_cpe: true,
        worst_level: 'critical',
        with_vulnerabilities: true,
      },
      null,
      25,
    );
    expect(page.pager.pageIndex()).toBe(0);
    const calls = service.listSoftware.mock.calls.length;
    page.setCategory('WebServer');
    expect(service.listSoftware.mock.calls.length).toBe(calls);

    page.clearFilters();
    page.setPageSize(50);
    await fixture.whenStable();
    expect(service.listSoftware).toHaveBeenLastCalledWith(NO_FILTERS, null, 50);
  });

  it('tells an empty catalogue from an empty filtered result', async () => {
    const service = new FakeService();
    service.listSoftware.mockReturnValue(of({ items: [], nextCursor: null }));
    service.catalogue.mockReturnValue(of({ items: [], complete: true }));
    const { fixture, page, element } = await render(service);
    expect(element.textContent).toContain(
      'Aún no hay software instalado en el inventario de iTop.',
    );
    expect(element.textContent).toContain('Aún no hay software para graficar.');
    expect(element.textContent).toContain('iTop no registra licencias de software.');
    page.setHasCpe('false');
    await fixture.whenStable();
    expect(element.textContent).toContain('No hay software que coincida con los filtros.');
  });

  it('switches the chart and says when the totals and the export cover part of the catalogue', async () => {
    const service = new FakeService();
    service.catalogue.mockReturnValue(of({ items: [OPENSSL], complete: false }));
    const { fixture, page, element } = await render(service);
    expect(element.textContent).toContain('los totales cuentan los primeros 1');
    expect(element.querySelector('.table-panel [role="note"]')?.textContent).toContain(
      'la exportación y los totales incluyen solo los primeros 1 productos',
    );
    page.chart.set('cpe');
    await fixture.whenStable();
    expect(element.querySelector('.chart-panel h2')?.textContent).toContain(
      'Software con y sin CPE',
    );
  });

  it('keeps the prototype chart of vulnerabilities by priority with its counts', async () => {
    const service = new FakeService();
    const { fixture, page, element } = await render(service);
    expect(service.vulnerabilityCounts).toHaveBeenCalledTimes(1);
    page.chart.set('priority');
    await fixture.whenStable();
    const counts = Array.from(element.querySelectorAll('.vulnerability-count')).map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(counts).toEqual(['Críticas1', 'Altas0', 'Medias0', 'Bajas2']);
    expect(
      (element.querySelector('.vulnerability-count') as HTMLElement).style.getPropertyValue(
        '--priority-color',
      ),
    ).toBe('#dc2626');
    expect(element.querySelector('app-grafico-dashboard')?.getAttribute('aria-label')).toBe(
      'Vulnerabilidades únicas por prioridad en el inventario',
    );
    expect(element.querySelector('.chart-panel')?.classList).toContain(
      'vulnerability-priority-panel',
    );
  });

  it('says when the inventory has no open vulnerabilities and retries a failed count', async () => {
    const service = new FakeService();
    service.vulnerabilityCounts.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Sin conteos.')),
    );
    const { fixture, page, element } = await render(service);
    page.chart.set('priority');
    await fixture.whenStable();
    expect(element.querySelector('.chart-panel [role="alert"]')?.textContent).toContain(
      'Sin conteos.',
    );
    service.vulnerabilityCounts.mockReturnValue(of({ critical: 0, high: 0, medium: 0, low: 0 }));
    (element.querySelector('.chart-panel [role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Sin vulnerabilidades abiertas en el inventario.');
  });

  it('shows the errors of the table, the cards and the totals, each with its retry', async () => {
    const service = new FakeService();
    const failure = () => throwError(() => new ApiError(500, 'internal_error', 'Falló.'));
    service.listSoftware.mockReturnValue(failure());
    service.summary.mockReturnValue(failure());
    service.catalogue.mockReturnValue(failure());
    const { fixture, element } = await render(service);
    expect(element.querySelectorAll('[role="alert"]')).toHaveLength(2);
    expect(element.querySelector('.kpi-grid .kpi-value')?.textContent?.trim()).toBe('Sin datos');

    service.listSoftware.mockReturnValue(of({ items: [OPENSSL], nextCursor: null }));
    service.catalogue.mockReturnValue(of({ items: [OPENSSL], complete: true }));
    for (const button of Array.from(
      element.querySelectorAll('[role="alert"] button'),
    ) as HTMLButtonElement[]) {
      button.click();
    }
    await fixture.whenStable();
    expect(cells(element)).toHaveLength(1);
    expect(element.querySelector('app-grafico-dashboard')).not.toBeNull();
  });

  it('lets an analyst map a product and reloads the catalogue after saving', async () => {
    const service = new FakeService();
    const { fixture, page, element } = await render(service, 'analyst');
    const buttons = Array.from(element.querySelectorAll('.row-action')).map((button) =>
      button.textContent?.trim(),
    );
    expect(buttons).toEqual(['Cambiar CPE', 'Mapear CPE']);
    (element.querySelectorAll('.row-action')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(page.mapping()).toEqual({ id: KERNEL.id, name: KERNEL.name, cpe: null });
    const dialog = fixture.debugElement.query(
      (node) => node.componentInstance instanceof CpeMappingDialog,
    );
    expect(dialog).not.toBeNull();

    (dialog.componentInstance as CpeMappingDialog).saved.emit({
      software: KERNEL.id,
      cpe: 'cpe:2.3:o:amazon:linux_kernel:*:*:*:*:*:*:*:*',
    });
    await fixture.whenStable();
    expect(page.mapping()).toBeNull();
    expect(element.querySelector('.notice')?.textContent).toContain(
      'CPE guardado para Amazon Linux 2023 kernel',
    );
    expect(service.catalogue).toHaveBeenCalledTimes(2);
    expect(service.listSoftware).toHaveBeenLastCalledWith(NO_FILTERS, null, 25);

    page.openMapping(OPENSSL);
    await fixture.whenStable();
    (
      fixture.debugElement.query((node) => node.componentInstance instanceof CpeMappingDialog)
        .componentInstance as CpeMappingDialog
    ).cancelled.emit();
    await fixture.whenStable();
    expect(page.mapping()).toBeNull();
  });

  it('exports the whole catalogue as CSV', async () => {
    const { page } = await render();
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:catalogue');
    const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    page.exportCsv();
    const blob = created.mock.calls[0]![0] as Blob;
    const csv = await blob.text();
    expect(csv.split('\r\n')[0]).toContain('"Software","Categorías","Versiones"');
    expect(csv).toContain('"OpenSSL","Otro software; Servidor web","3.0.7","3","3","1","1","1"');
    expect(csv).toContain('"Amazon Linux 2023 kernel"');
    expect(click).toHaveBeenCalled();
    expect(revoked).toHaveBeenCalledWith('blob:catalogue');
    vi.restoreAllMocks();
  });

  it('links to create a software record in iTop when the console is configured', async () => {
    const { element } = await render(new FakeService(), 'reader', 'https://itop.example.test');
    const link = element.querySelector('.itop-note a') as HTMLAnchorElement;
    expect(link.href).toBe('https://itop.example.test/pages/UI.php?operation=new&class=Software');
  });
});
