import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { StixExportPage } from './stix-export.page';
import { StixBundle, StixService } from './stix.service';
import { VulnerabilitiesService } from './vulnerabilities.service';

class FakeStix {
  download = vi.fn<StixService['download']>();
  exportBundle = vi.fn<StixService['exportBundle']>(() =>
    of({ type: 'bundle', id: 'bundle--1', objects: [{}, {}, {}] }),
  );
  listRuns = vi.fn<StixService['listRuns']>(() =>
    of({
      items: [
        {
          id: 'r-1',
          kind: 'scan',
          status: 'succeeded',
          started_at: '2026-11-24T00:00:00Z',
          finished_at: '2026-11-24T00:05:00Z',
          progress: 100,
        },
      ],
      nextCursor: null,
    }),
  );
}

class FakeVulnerabilities {
  listGroups = vi.fn<VulnerabilitiesService['listGroups']>(() =>
    of({
      items: [
        {
          group_id: 'g-1',
          cve: 'CVE-2026-10001',
          product: 'OpenSSL',
        } as unknown as never,
      ],
      nextCursor: null,
    }),
  );
  getDetail = vi.fn<VulnerabilitiesService['getDetail']>(
    (groupId) => of({ group_id: groupId, cve: 'CVE-2025-0001', product: 'nginx' }) as never,
  );
}

async function render(
  stixService: FakeStix,
  url = '/exportacion-stix',
  vulnerabilities = new FakeVulnerabilities(),
) {
  TestBed.configureTestingModule({
    providers: [
      { provide: StixService, useValue: stixService },
      { provide: VulnerabilitiesService, useValue: vulnerabilities },
      ...provideFakeSession('analyst'),
      provideRouter([
        { path: 'exportacion-stix', component: StixExportPage },
        { path: 'otra', children: [] },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl(url, StixExportPage);
  await harness.fixture.whenStable();
  return { page, harness, element: harness.routeNativeElement as HTMLElement };
}

describe('StixExportPage', () => {
  it('preselects the vulnerability of the link and exports it, highly classified left out', async () => {
    const service = new FakeStix();
    const { page, harness, element } = await render(service, '/exportacion-stix?grupo=g-1');
    expect(page.groupId()).toBe('g-1');
    expect(page.problem()).toBe('');
    (element.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    expect(service.exportBundle).toHaveBeenCalledWith({
      scope: 'vulnerability',
      vulnerability_id: 'g-1',
      exclude_ultra_classified: true,
    });
    expect(service.download).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bundle--1' }),
      expect.stringMatching(/^hermes-stix-vulnerability-\d{8}-\d{4}\.json$/),
    );
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Bundle descargado con 3 objetos.',
    );
  });

  it('offers the vulnerability of the link once, even before its page is loaded', async () => {
    const { page } = await render(new FakeStix(), '/exportacion-stix?grupo=g-1');
    expect(page.groupOptions()).toEqual([{ id: 'g-1', label: 'CVE-2026-10001 · OpenSSL' }]);

    TestBed.resetTestingModule();
    const other = await render(new FakeStix(), '/exportacion-stix?grupo=g-far');
    expect(other.page.groupOptions()[0]).toEqual({ id: 'g-far', label: 'CVE-2025-0001 · nginx' });
    expect(other.page.groupId()).toBe('g-far');
    const select = other.element.querySelector('select[name="group"]') as HTMLSelectElement;
    expect(select.options[select.selectedIndex].textContent?.trim()).toBe('CVE-2025-0001 · nginx');
  });

  it('loads further pages of vulnerabilities and runs with the API cursors', async () => {
    const vulnerabilities = new FakeVulnerabilities();
    vulnerabilities.listGroups.mockImplementation((_filters, cursor) =>
      of(
        cursor === null
          ? {
              items: [{ group_id: 'g-1', cve: 'CVE-2026-10001', product: 'OpenSSL' } as never],
              nextCursor: 'g.sig',
            }
          : {
              items: [{ group_id: 'g-2', cve: 'CVE-2020-0002', product: 'bash' } as never],
              nextCursor: null,
            },
      ),
    );
    const stix = new FakeStix();
    stix.listRuns.mockReturnValueOnce(of({ items: [], nextCursor: 'r.sig' }));
    const { page, harness, element } = await render(stix, '/exportacion-stix', vulnerabilities);
    expect(vulnerabilities.listGroups).toHaveBeenCalledWith({}, null, 200);
    const more = () => element.querySelector('button.load-more') as HTMLButtonElement | null;
    expect(more()?.textContent).toContain('Cargar más vulnerabilidades');
    more()!.click();
    await harness.fixture.whenStable();
    expect(vulnerabilities.listGroups).toHaveBeenLastCalledWith({}, 'g.sig', 200);
    expect(page.groupOptions().map((option) => option.id)).toEqual(['g-1', 'g-2']);
    expect(more()).toBeNull();

    page.setScope('run');
    await harness.fixture.whenStable();
    expect(more()?.textContent).toContain('Cargar corridas anteriores');
    more()!.click();
    await harness.fixture.whenStable();
    expect(stix.listRuns).toHaveBeenLastCalledWith('r.sig', 200);
    expect(page.runOptions().map((option) => option.id)).toEqual(['r-1']);
  });

  it('asks for the missing choice of each scope and keeps the button disabled', async () => {
    const { page, harness, element } = await render(new FakeStix());
    expect(page.problem()).toBe('Elige la vulnerabilidad que quieres exportar.');
    page.setScope('run');
    expect(page.problem()).toBe('Elige la corrida que quieres exportar.');
    page.setScope('date_range');
    expect(page.problem()).toBe('Indica la fecha inicial y la final.');
    page.dateFrom.set('2026-11-20');
    page.dateTo.set('2026-11-10');
    await harness.fixture.whenStable();
    expect(page.problem()).toBe('La fecha inicial no puede ser posterior a la final.');
    expect((element.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('sends a run or a whole-day date range', async () => {
    const service = new FakeStix();
    const { page, harness, element } = await render(service);
    page.setScope('run');
    page.runId.set('r-1');
    page.excludeHighlyClassified.set(false);
    page.export();
    expect(service.exportBundle).toHaveBeenLastCalledWith({
      scope: 'run',
      run_id: 'r-1',
      exclude_ultra_classified: false,
    });
    page.setScope('date_range');
    await harness.fixture.whenStable();
    expect(element.textContent).toContain('días completos en hora UTC, incluido el último');
    page.dateFrom.set('2026-11-01');
    page.dateTo.set('2026-11-24');
    page.export();
    expect(service.exportBundle).toHaveBeenLastCalledWith({
      scope: 'date_range',
      // Days without time: the backend covers 2026-11-01T00:00Z up to, not including, 2026-11-25T00:00Z.
      date_from: '2026-11-01',
      date_to: '2026-11-24',
      exclude_ultra_classified: false,
    });
  });

  it('lists the runs with their kind and state in Spanish', async () => {
    const { page } = await render(new FakeStix());
    expect(page.runOptions()[0].label).toContain('Escaneo');
    expect(page.runOptions()[0].label).toContain('Terminó bien');
    expect(page.runOptions()[0].label).not.toContain('succeeded');
  });

  it('drops a late bundle once the person has left the screen', async () => {
    const service = new FakeStix();
    const pending = new Subject<StixBundle>();
    service.exportBundle.mockReturnValue(pending);
    const { page, harness } = await render(service, '/exportacion-stix?grupo=g-1');
    page.export();
    expect(pending.observed).toBe(true);
    await harness.navigateByUrl('/otra');
    expect(pending.observed).toBe(false);
    pending.next({ type: 'bundle', id: 'bundle--late', objects: [] });
    expect(service.download).not.toHaveBeenCalled();
  });

  it('shows the API message when the export fails', async () => {
    const service = new FakeStix();
    service.exportBundle.mockReturnValue(
      throwError(
        () => new ApiError(403, 'forbidden', 'No tienes permiso para realizar esta acción.'),
      ),
    );
    const { page, harness, element } = await render(service, '/exportacion-stix?grupo=g-1');
    page.export();
    await harness.fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No tienes permiso para realizar esta acción.',
    );
    expect(page.exporting()).toBe(false);
    expect(service.download).not.toHaveBeenCalled();
  });
});
