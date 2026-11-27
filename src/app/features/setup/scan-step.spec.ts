import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { formatDateTime } from '../../shared/labels';
import { isActive, SCAN_POLLING, SetupScanStep } from './scan-step';
import { Run, SetupService } from './setup.service';

const STARTED = '2026-11-27T06:00:00Z';

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: 'scan-1',
    kind: 'scan',
    status: 'queued',
    started_at: STARTED,
    finished_at: null,
    progress: 0,
    ...overrides,
  };
}

class FakeSetup {
  /** What each read of the latest scans answers, in order; the last answer repeats. */
  answers: (Run[] | Error)[] = [[]];
  scans = vi.fn<(limit: number, since?: string | null) => Observable<Run[]>>(() => {
    const answer = this.answers.length > 1 ? this.answers.shift()! : this.answers[0];
    return answer instanceof Error ? throwError(() => answer) : of(answer);
  });
  launchScan = vi.fn<SetupService['launchScan']>(() => of(run()));
}

async function render(service = new FakeSetup(), maxPolls = 50) {
  TestBed.configureTestingModule({
    imports: [SetupScanStep],
    providers: [
      { provide: SetupService, useValue: service },
      { provide: SCAN_POLLING, useValue: { intervalMs: 1, maxPolls } },
    ],
  });
  const fixture = TestBed.createComponent(SetupScanStep);
  const finished = vi.fn();
  fixture.componentInstance.finished.subscribe(finished);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = () => element.querySelector('.launch-scan') as HTMLButtonElement;
  /** Waits until the page shows `expected` (the polling runs on real timers). */
  const until = async (check: () => void) => {
    await vi.waitFor(async () => {
      await fixture.whenStable();
      check();
    });
  };
  return { fixture, element, service, finished, button, until };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SetupScanStep', () => {
  it('launches the first scan and follows it until it ends', async () => {
    const service = new FakeSetup();
    const { fixture, element, finished, button, until } = await render(service);
    expect(service.scans).toHaveBeenCalledWith(1);
    expect(text(element.querySelector('.step-count'))).toBe('Todavía no hay escaneos.');
    expect(text(button())).toBe('Lanzar escaneo simulado');

    service.answers = [
      [run({ id: 'other', status: 'succeeded', progress: 100 })],
      [run({ status: 'running', progress: 40 })],
      [run({ status: 'succeeded', progress: 100, finished_at: '2026-11-27T06:05:00Z' })],
    ];
    button().click();
    // Checked before the first read of the runs (the polling timer cannot fire during synchronous code).
    fixture.detectChanges();
    expect(service.launchScan).toHaveBeenCalledTimes(1);
    expect(text(element.querySelector('.scan-status strong'))).toBe('En cola');
    expect(text(element.querySelector('.scan-status span'))).toBe(
      `Iniciado ${formatDateTime(STARTED)}`,
    );
    expect(button().disabled).toBe(true);
    expect(text(element.querySelector('[role="status"]'))).toContain(
      'Se lanzó el escaneo simulado',
    );
    // A second launch while the scan is active does nothing.
    fixture.componentInstance.launch();
    expect(service.launchScan).toHaveBeenCalledTimes(1);

    await until(() => expect(finished).toHaveBeenCalledTimes(1));
    // Each reading asks for the scans started since the followed one.
    expect(service.scans).toHaveBeenLastCalledWith(20, STARTED);
    expect(text(element.querySelector('.scan-status strong'))).toBe('Terminó bien');
    expect((element.querySelector('progress') as HTMLProgressElement).value).toBe(100);
    expect(text(element.querySelector('.scan-run .item-number'))).toBe('100 %');
    expect(text(element.querySelector('[role="status"]'))).toBe('El escaneo terminó bien.');
    expect(text(button())).toBe('Lanzar otro escaneo');
    expect(button().disabled).toBe(false);
    // It stops reading once the scan ended.
    const reads = service.scans.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(service.scans.mock.calls.length).toBe(reads);
  });

  it('keeps following a scan that was already running and reports a failure', async () => {
    const service = new FakeSetup();
    service.answers = [
      [run({ status: 'running', progress: 10 })],
      [run({ status: 'failed', progress: 60 })],
    ];
    const { element, finished, until } = await render(service);
    await until(() => expect(finished).toHaveBeenCalledTimes(1));
    expect(text(element.querySelector('.scan-status strong'))).toBe('Terminó con error');
    expect(element.querySelector('.scan-run')?.getAttribute('data-status')).toBe('failed');
    expect(text(element.querySelector('[role="status"]'))).toContain('terminó con error');
  });

  it('only shows a finished scan, without reading again', async () => {
    const service = new FakeSetup();
    service.answers = [[run({ status: 'succeeded', progress: 100 })]];
    const { element, finished } = await render(service);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(service.scans).toHaveBeenCalledTimes(1);
    expect(finished).not.toHaveBeenCalled();
    expect(text(element.querySelector('.scan-status strong'))).toBe('Terminó bien');
  });

  it('keeps launching off until the latest scan can be read, so a scan in progress is never hidden', async () => {
    const service = new FakeSetup();
    service.answers = [
      new ApiError(503, 'auth_unavailable', 'El servicio no responde.'),
      [run({ status: 'running', progress: 30 })],
    ];
    const { fixture, element, button } = await render(service, 1000);
    expect(text(element.querySelector('[role="alert"]'))).toContain('El servicio no responde.');
    expect(text(element.querySelector('.step-count'))).toBe('No se pudo leer el último escaneo.');
    expect(button().disabled).toBe(true);
    fixture.componentInstance.launch();
    expect(service.launchScan).not.toHaveBeenCalled();

    const retry = element.querySelector('[role="alert"] button') as HTMLButtonElement;
    expect(text(retry)).toBe('Reintentar');
    retry.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(text(element.querySelector('.scan-status strong'))).toBe('En ejecución');
    expect(button().disabled).toBe(true);
    fixture.destroy();
  });

  it('shows the API message when the scan cannot be launched', async () => {
    const service = new FakeSetup();
    const { fixture, element, button } = await render(service);
    service.launchScan.mockReturnValueOnce(
      throwError(() => new ApiError(403, 'forbidden', 'No tienes permiso.')),
    );
    button().click();
    await fixture.whenStable();
    expect(text(element.querySelector('[role="alert"]'))).toBe('No tienes permiso.');
    expect(element.querySelector('[role="alert"] button')).toBeNull();
    expect(button().disabled).toBe(false);
  });

  it('waits for a slow reading instead of cancelling it on the next tick', async () => {
    const service = new FakeSetup();
    service.answers = [[run({ status: 'running', progress: 10 })]];
    const slow = new Subject<Run[]>();
    const { fixture, element, finished, until } = await render(service);
    service.scans.mockReturnValue(slow);
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Ticks kept coming, but only one reading is on its way.
    const reads = service.scans.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(service.scans.mock.calls.length).toBe(reads);
    slow.next([run({ status: 'succeeded', progress: 100 })]);
    await until(() => expect(finished).toHaveBeenCalledTimes(1));
    await fixture.whenStable();
    expect(text(element.querySelector('.scan-status strong'))).toBe('Terminó bien');
  });

  it('offers to read again when following fails, and resumes', async () => {
    const service = new FakeSetup();
    service.answers = [
      [run({ status: 'running', progress: 10 })],
      new ApiError(500, 'internal_error', 'Error interno del servidor.'),
      [run({ status: 'succeeded', progress: 100 })],
    ];
    const { element, finished, until } = await render(service);
    await until(() =>
      expect(text(element.querySelector('[role="alert"]'))).toContain('Error interno'),
    );
    const resume = element.querySelector('[role="alert"] button') as HTMLButtonElement;
    expect(text(resume)).toBe('Volver a consultar');
    resume.click();
    await until(() => expect(finished).toHaveBeenCalledTimes(1));
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('stops after the last read and points to Corridas while the scan is still running', async () => {
    const service = new FakeSetup();
    service.answers = [[run({ status: 'running', progress: 10 })]];
    const { element, finished, until } = await render(service, 2);
    await until(() =>
      expect(text(element.querySelector('[role="alert"]'))).toContain(
        'consulta su avance en Corridas',
      ),
    );
    expect(service.scans).toHaveBeenCalledTimes(3);
    expect(finished).not.toHaveBeenCalled();
    // A run that vanished from the latest scans keeps the last state shown.
    service.answers = [[]];
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await until(() => expect(service.scans).toHaveBeenCalledTimes(5));
    expect(text(element.querySelector('.scan-status strong'))).toBe('En ejecución');
  });

  it('treats only queued and running scans as active', () => {
    expect(isActive({ status: 'queued' })).toBe(true);
    expect(isActive({ status: 'running' })).toBe(true);
    expect(isActive({ status: 'succeeded' })).toBe(false);
    expect(isActive({ status: 'failed' })).toBe(false);
  });
});
