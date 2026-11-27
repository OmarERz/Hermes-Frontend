import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { APP_CONFIG } from '../../core/config/app-config';
import { provideFakeSession } from '../../testing/fake-session';
import { AssetsPage } from './assets.page';
import { PAYMENTS, SUMMARY, testConfig, WEB } from './inventory.fixtures';
import { InventoryService } from './inventory.service';

/** Every filter empty: what the page asks for before the person picks one. */
const NO_FILTERS = {
  q: null,
  itop_class: null,
  criticality: null,
  exposed: null,
  classification: null,
  with_findings: null,
  owner: null,
  custodian: null,
};

class FakeService {
  listAssets = vi.fn<InventoryService['listAssets']>(() =>
    of({ items: [PAYMENTS, WEB], nextCursor: 'n.sig' }),
  );
  summary = vi.fn<InventoryService['summary']>(() => of(SUMMARY));
}

async function render(service = new FakeService(), itopBaseUrl: string | null = null) {
  TestBed.configureTestingModule({
    imports: [AssetsPage],
    providers: [
      { provide: InventoryService, useValue: service },
      { provide: APP_CONFIG, useValue: testConfig(itopBaseUrl) },
      ...provideFakeSession('reader'),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(AssetsPage);
  await fixture.whenStable();
  return {
    fixture,
    page: fixture.componentInstance,
    element: fixture.nativeElement as HTMLElement,
  };
}

function cells(row: Element): string[] {
  return Array.from(row.querySelectorAll('td')).map(
    (td) => td.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

describe('AssetsPage', () => {
  it('lists every CI with its iTop class, hardware, owner, custodian and findings', async () => {
    const service = new FakeService();
    const { element } = await render(service);
    const rows = element.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    const payments = cells(rows[0]!);
    expect(payments.slice(0, 11)).toEqual([
      'CI-1',
      'srv-pagos-01PagosServidor de cobros con tarjeta',
      'Servidor',
      '16 vCPU',
      '64 GB',
      'Ubuntu 22.04',
      'Dueña de Pagos',
      'Infraestructura Linux',
      'Alta',
      'Expuesto',
      'Altamente clasificada',
    ]);
    expect(payments[11]).toBe('Crítica · 922 abiertas · 1 en KEV');
    expect(payments[12]).toBe('1');
    expect(rows[0]!.querySelector('a.itop-link')?.getAttribute('href')).toBe(PAYMENTS.itop_url);
    expect(rows[0]!.querySelector('a.row-link')?.getAttribute('href')).toBe('/activos/CI-1');

    const web = cells(rows[1]!);
    expect(web.slice(2, 10)).toEqual([
      'Servidor',
      '—',
      '—',
      '—',
      'Sin responsable',
      'Sin custodio',
      'Media',
      'Sin dato',
    ]);
    expect(web[11]).toBe('Sin vulnerabilidades');
    // No iTop URL from the API (iTop not configured): no link.
    expect(rows[1]!.querySelector('a.itop-link')).toBeNull();
    expect(service.listAssets).toHaveBeenCalledWith(NO_FILTERS, null, 25);
  });

  it('shows the totals and distributions of the summary', async () => {
    const { element } = await render();
    const cards = Array.from(element.querySelectorAll('.stat-card')).map((card) =>
      card.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(cards).toEqual([
      'Total de activos3',
      'Criticidad alta1',
      'Responsables asignados11 sin responsable',
      'Con vulnerabilidades abiertas21 con KEV',
    ]);
    const classes = Array.from(
      element.querySelectorAll('.distribution-row strong:first-child'),
    ).map((item) => item.textContent?.trim());
    expect(classes.slice(0, 2)).toEqual(['Servidor', 'Máquina virtual']);
    const criticality = Array.from(element.querySelectorAll('.state-row .state-count')).map(
      (item) => item.textContent?.trim(),
    );
    expect(criticality).toEqual(['1', '2', '0', '0']);
    expect(element.querySelector('.sync-note')?.textContent).toContain('2026');
    const classOptions = Array.from(
      element.querySelectorAll('select[aria-label="Clase de iTop"] option'),
    ).map((option) => option.textContent?.trim());
    expect(classOptions).toEqual(['Todas las clases', 'Máquina virtual', 'Servidor']);
  });

  it('pages with the cursor and starts again from the first page when a filter changes', async () => {
    const service = new FakeService();
    const { fixture, page, element } = await render(service);
    (element.querySelector('[aria-label="Página siguiente"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.listAssets).toHaveBeenLastCalledWith(NO_FILTERS, 'n.sig', 25);

    page.setQuery('  pagos ');
    page.setItopClass('Server');
    page.setCriticality('high');
    page.setExposed('true');
    page.setClassification('public');
    page.setWithFindings('false');
    page.setOwner('Ana');
    page.setCustodian('Seguridad');
    await fixture.whenStable();
    expect(service.listAssets).toHaveBeenLastCalledWith(
      {
        q: 'pagos',
        itop_class: 'Server',
        criticality: 'high',
        exposed: true,
        classification: 'public',
        with_findings: false,
        owner: 'Ana',
        custodian: 'Seguridad',
      },
      null,
      25,
    );
    expect(page.pager.pageIndex()).toBe(0);

    const calls = service.listAssets.mock.calls.length;
    page.setOwner('Ana');
    expect(service.listAssets.mock.calls.length).toBe(calls);

    page.clearFilters();
    page.setPageSize(10);
    await fixture.whenStable();
    expect(service.listAssets).toHaveBeenLastCalledWith(NO_FILTERS, null, 10);
  });

  it('keeps a selected class that no CI has any more in the class filter', async () => {
    const { fixture, page, element } = await render();
    page.setItopClass('NetworkDevice');
    await fixture.whenStable();
    const options = Array.from(
      element.querySelectorAll('select[aria-label="Clase de iTop"] option'),
    ).map((option) => option.textContent?.trim());
    expect(options).toContain('Equipo de red');
  });

  it('tells an empty inventory from an empty filtered result', async () => {
    const service = new FakeService();
    service.listAssets.mockReturnValue(of({ items: [], nextCursor: null }));
    const { fixture, page, element } = await render(service);
    expect(element.textContent).toContain('Aún no hay activos sincronizados desde iTop.');
    page.setExposed('false');
    await fixture.whenStable();
    expect(element.textContent).toContain('No hay activos que coincidan con los filtros.');
  });

  it('shows the API error of the list and of the summary with a retry', async () => {
    const service = new FakeService();
    service.listAssets.mockReturnValue(
      throwError(() => new ApiError(403, 'forbidden', 'No tienes permiso.')),
    );
    service.summary.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Falla.')),
    );
    const { fixture, element } = await render(service);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('No tienes permiso.');
    expect(element.querySelector('.stat-card strong')?.textContent?.trim()).toBe('Sin datos');

    service.listAssets.mockReturnValue(of({ items: [PAYMENTS], nextCursor: null }));
    service.summary.mockReturnValue(of(SUMMARY));
    const retry = element.querySelector('[role="alert"] button') as HTMLButtonElement;
    retry.click();
    await fixture.whenStable();
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('hides and shows the inventory table and reloads on demand', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    const toggle = Array.from(element.querySelectorAll('.action-row button')).find((button) =>
      button.textContent?.includes('Ocultar inventario'),
    ) as HTMLButtonElement;
    toggle.click();
    await fixture.whenStable();
    expect((element.querySelector('.panel.inventory') as HTMLElement).hidden).toBe(true);
    expect(toggle.textContent).toContain('Ver inventario');

    const refresh = Array.from(element.querySelectorAll('.action-row button')).find((button) =>
      button.textContent?.includes('Actualizar'),
    ) as HTMLButtonElement;
    refresh.click();
    await fixture.whenStable();
    expect(service.summary).toHaveBeenCalledTimes(2);
  });

  it('offers to create a CI in iTop only when the iTop console is configured', async () => {
    const { element } = await render(new FakeService(), null);
    expect(element.querySelector('.itop-create')).toBeNull();
    TestBed.resetTestingModule();

    const configured = await render(new FakeService(), 'https://itop.example.test');
    const link = configured.element.querySelector('.itop-create a') as HTMLAnchorElement;
    expect(link.textContent).toContain('Crear en iTop');
    expect(link.href).toBe('https://itop.example.test/pages/UI.php?operation=new&class=Server');
    configured.page.createClass.set('VirtualMachine');
    await configured.fixture.whenStable();
    expect(link.href).toContain('class=VirtualMachine');
  });

  it('says when iTop never synced', async () => {
    const service = new FakeService();
    service.summary.mockReturnValue(of({ ...SUMMARY, last_sync_at: null, by_class: {} }));
    const { element } = await render(service);
    expect(element.querySelector('.sync-note')?.textContent).toContain('Sin sincronizar');
    expect(element.textContent).toContain('Aún no hay activos para distribuir.');
  });
});
