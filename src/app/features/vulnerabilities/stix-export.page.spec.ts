import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { StixExportPage } from './stix-export.page';
import { StixService } from './stix.service';
import { VulnerabilitiesService } from './vulnerabilities.service';

class FakeStix {
  download = vi.fn<StixService['download']>();
  exportBundle = vi.fn<StixService['exportBundle']>(() =>
    of({ type: 'bundle', id: 'bundle--1', objects: [{}, {}, {}] }),
  );
  latestRuns = vi.fn<StixService['latestRuns']>(() =>
    of([
      {
        id: 'r-1',
        kind: 'scan',
        status: 'succeeded',
        started_at: '2026-11-24T00:00:00Z',
        finished_at: '2026-11-24T00:05:00Z',
        progress: 100,
      },
    ]),
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
}

async function render(stixService: FakeStix, url = '/exportacion-stix') {
  TestBed.configureTestingModule({
    providers: [
      { provide: StixService, useValue: stixService },
      { provide: VulnerabilitiesService, useValue: new FakeVulnerabilities() },
      ...provideFakeSession('analyst'),
      provideRouter([{ path: 'exportacion-stix', component: StixExportPage }]),
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
    const { page } = await render(service);
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
    page.dateFrom.set('2026-11-01');
    page.dateTo.set('2026-11-24');
    page.export();
    expect(service.exportBundle).toHaveBeenLastCalledWith({
      scope: 'date_range',
      date_from: '2026-11-01T00:00:00Z',
      date_to: '2026-11-24T23:59:59Z',
      exclude_ultra_classified: false,
    });
  });

  it('lists the runs with their kind in Spanish', async () => {
    const { page } = await render(new FakeStix());
    expect(page.runOptions()[0].label).toContain('Escaneo');
    expect(page.runOptions()[0].label).toContain('succeeded');
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
