import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { APP_CONFIG } from '../../core/config/app-config';
import { provideFakeSession } from '../../testing/fake-session';
import { AssetDetailPage } from './asset-detail.page';
import {
  DETAIL,
  INSTALLED_KERNEL,
  INSTALLED_OPENSSL,
  PAYMENTS,
  testConfig,
} from './inventory.fixtures';
import { InventoryService } from './inventory.service';

class FakeService {
  asset = vi.fn<InventoryService['asset']>(() => of(DETAIL));
  findAsset = vi.fn<InventoryService['findAsset']>(() => of(PAYMENTS));
  assetSoftware = vi.fn<InventoryService['assetSoftware']>(() =>
    of([INSTALLED_OPENSSL, INSTALLED_KERNEL]),
  );
}

async function render(service = new FakeService(), itopBaseUrl: string | null = null) {
  TestBed.configureTestingModule({
    imports: [AssetDetailPage],
    providers: [
      { provide: InventoryService, useValue: service },
      { provide: APP_CONFIG, useValue: testConfig(itopBaseUrl) },
      ...provideFakeSession('reader'),
      provideRouter([{ path: 'activos/:ciId', component: AssetDetailPage }]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl('/activos/CI-1', AssetDetailPage);
  await harness.fixture.whenStable();
  return {
    fixture: harness.fixture,
    page,
    element: harness.routeNativeElement as HTMLElement,
  };
}

function facts(element: HTMLElement): Record<string, string> {
  return Object.fromEntries(
    Array.from(element.querySelectorAll('.facts > div')).map((item) => [
      item.querySelector('dt')?.textContent?.trim() ?? '',
      item.querySelector('dd')?.textContent?.trim() ?? '',
    ]),
  );
}

function rowsOf(element: HTMLElement, region: string): string[][] {
  return Array.from(
    element.querySelectorAll(`[aria-label="${region}; desplazamiento horizontal"] tbody tr`),
  ).map((row) =>
    Array.from(row.querySelectorAll('td')).map(
      (td) => td.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    ),
  );
}

describe('AssetDetailPage', () => {
  it('shows the iTop data of the CI from its detail and its inventory row', async () => {
    const service = new FakeService();
    const { element, page } = await render(service);
    expect(service.asset).toHaveBeenCalledWith('CI-1');
    expect(service.findAsset).toHaveBeenCalledWith('CI-1');
    expect(page.title()).toBe('srv-pagos-01');
    expect(element.querySelector('.description')?.textContent).toContain(
      'Servidor de cobros con tarjeta',
    );
    expect(facts(element)).toEqual({
      'ID del CI': 'CI-1',
      'Clase de iTop': 'Servidor · Server',
      CPU: '16 vCPU',
      RAM: '64 GB',
      'Sistema operativo': 'Ubuntu 22.04',
      Servicio: 'Pagos',
      Criticidad: 'Alta',
      'Exposición a internet': 'Expuesto',
      Clasificación: 'Altamente clasificada',
      'Datos personales': 'Sí',
      Responsable: 'Dueña de Pagos',
      Custodio: 'Infraestructura Linux',
      'Última sincronización con iTop': expect.stringContaining('2026'),
    });
    const cards = Array.from(element.querySelectorAll('.stat-card strong')).map((item) =>
      item.textContent?.trim(),
    );
    expect(cards).toEqual(['92', '1', '1', '2']);
    expect(element.querySelector('.stat-card em')?.textContent?.trim()).toBe('Crítica');
  });

  it('lists the installed software with category, status, licence, CPE and findings', async () => {
    const { element } = await render();
    const [openssl, kernel] = rowsOf(element, 'Software instalado');
    expect(openssl).toEqual([
      'OpenSSL',
      '3.0.7',
      'Otro software',
      'Activa',
      expect.stringMatching(/^Soporte OpenSSLLímite: 10 servidoresDel .+ al .+$/),
      'cpe:2.3:a:openssl:openssl:*:*:*:*:*:*:*:*',
      'Crítica · 2',
      'Biblioteca TLS del sistema',
    ]);
    expect(kernel).toEqual([
      'Amazon Linux 2023 kernel',
      'N/A Versión desconocida',
      'Sin dato',
      'Sin dato',
      'Sin licencia',
      'Sin CPEVer pendientes',
      'Sin vulnerabilidades',
      '—',
    ]);
    expect(element.querySelector('a[href="/pendientes-inventario"]')).not.toBeNull();
  });

  it('lists the vulnerability groups of the CI with a link to each one', async () => {
    const { element } = await render();
    const [row] = rowsOf(element, 'Vulnerabilidades del activo');
    expect(row?.slice(0, 7)).toEqual([
      'CVE-2026-10001',
      'OpenSSL 3.0.7',
      'Crítica',
      '92',
      'Nuevo',
      'Sí',
      'DEMO-1',
    ]);
    expect(element.querySelector('a.row-link')?.getAttribute('href')).toBe(
      `/vulnerabilidades/${DETAIL.findings[0]!.group_id}`,
    );
  });

  it('links to the CI in iTop with the API link or the configured console', async () => {
    const { element } = await render(new FakeService(), 'https://itop.example.test');
    const links = Array.from(element.querySelectorAll('.itop-links a')) as HTMLAnchorElement[];
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      expect.stringContaining('Ver en iTop'),
      expect.stringContaining('Editar en iTop'),
    ]);
    expect(links[0]!.href).toBe(PAYMENTS.itop_url);
    expect(links[1]!.href).toBe(
      'https://itop.example.test/pages/UI.php?operation=modify&class=Server&id=CI-1',
    );
  });

  it('shows a CI without findings, software or inventory row without inventing data', async () => {
    const service = new FakeService();
    service.asset.mockReturnValue(
      of({
        ...DETAIL,
        findings: [],
        risk: 0,
        itop_class: null,
        cpu: null,
        ram: null,
        description: null,
        owner: null,
        custodian: null,
      }),
    );
    service.findAsset.mockReturnValue(of(null));
    service.assetSoftware.mockReturnValue(of([]));
    const { element } = await render(service);
    const shown = facts(element);
    expect(shown['Clase de iTop']).toBe('Sin dato');
    expect(shown['CPU']).toBe('—');
    expect(shown['Criticidad']).toBe('—');
    expect(shown['Responsable']).toBe('Sin responsable');
    expect(element.querySelector('.description')?.textContent).toContain(
      'Sin descripción en iTop.',
    );
    expect(element.textContent).toContain('iTop no registra software instalado en este activo.');
    expect(element.textContent).toContain('Este activo no tiene vulnerabilidades registradas.');
    expect(element.querySelector('.stat-card strong')?.textContent?.trim()).toBe(
      'Sin vulnerabilidades abiertas',
    );
  });

  it('says it is still reading the inventory row', async () => {
    const service = new FakeService();
    service.findAsset.mockReturnValue(NEVER);
    service.assetSoftware.mockReturnValue(NEVER);
    const { element } = await render(service);
    expect(facts(element)['Criticidad']).toBe('Cargando…');
    expect(element.textContent).toContain('Cargando el software instalado…');
  });

  it('takes the risk level from the open findings, never from a fixed one', async () => {
    const service = new FakeService();
    const [critical] = DETAIL.findings;
    service.asset.mockReturnValue(
      of({
        ...DETAIL,
        risk: 30,
        findings: [
          { ...critical!, status: 'fixed', final: 95, level: 'critical' },
          {
            ...critical!,
            group_id: 'a1',
            cve: 'CVE-2026-2',
            status: 'persistent',
            final: 30,
            level: 'low',
            in_kev: false,
          },
        ],
      }),
    );
    const { element } = await render(service);
    const cards = Array.from(element.querySelectorAll('.stat-card strong')).map((item) =>
      item.textContent?.trim(),
    );
    expect(cards.slice(0, 3)).toEqual(['30', '1', '0']);
    expect(element.querySelector('.stat-card em')?.textContent?.trim()).toBe('Baja');
    // The fixed group is still listed, with its status.
    expect(rowsOf(element, 'Vulnerabilidades del activo')).toHaveLength(2);
    expect(element.textContent).toContain('Corregido');
  });

  it('shows no risk when every finding of the CI is fixed', async () => {
    const service = new FakeService();
    service.asset.mockReturnValue(
      of({ ...DETAIL, findings: [{ ...DETAIL.findings[0]!, status: 'fixed' }] }),
    );
    const { element } = await render(service);
    expect(element.querySelector('.stat-card strong')?.textContent?.trim()).toBe(
      'Sin vulnerabilidades abiertas',
    );
  });

  it('keeps two installations of the same product and version as two rows', async () => {
    const service = new FakeService();
    service.assetSoftware.mockReturnValue(
      of([INSTALLED_OPENSSL, { ...INSTALLED_OPENSSL, status: 'inactive', licence: null }]),
    );
    const { element } = await render(service);
    const rows = rowsOf(element, 'Software instalado');
    expect(rows.map((row) => row[3])).toEqual(['Activa', 'Inactiva']);
  });

  it('shows the API error of the detail and loads again on retry', async () => {
    const service = new FakeService();
    service.asset.mockReturnValue(
      throwError(() => new ApiError(404, 'not_found', 'El activo no existe.')),
    );
    const { fixture, element } = await render(service);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('El activo no existe.');
    service.asset.mockReturnValue(of(DETAIL));
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(element.querySelector('.facts')).not.toBeNull();
  });

  it('retries the inventory row and the software on their own', async () => {
    const service = new FakeService();
    service.findAsset.mockReturnValue(throwError(() => new ApiError(500, 'internal_error', 'X')));
    service.assetSoftware.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Falló el software.')),
    );
    const { fixture, element } = await render(service);
    expect(element.textContent).toContain('No se pudieron leer la criticidad');
    expect(element.textContent).toContain('Falló el software.');
    expect(Array.from(element.querySelectorAll('.stat-card strong')).at(-1)?.textContent).toContain(
      'Sin datos',
    );

    service.findAsset.mockReturnValue(of(PAYMENTS));
    service.assetSoftware.mockReturnValue(of([INSTALLED_OPENSSL]));
    (element.querySelector('.link-button') as HTMLButtonElement).click();
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(facts(element)['Criticidad']).toBe('Alta');
    expect(rowsOf(element, 'Software instalado')).toHaveLength(1);
  });
});
