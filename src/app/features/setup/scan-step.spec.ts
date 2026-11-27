import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { formatDateTime } from '../../shared/labels';
import { RunEventsService, RunProgress } from '../runs/run-events';
import { isActive, SetupScanStep } from './scan-step';
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

function progress(value: number, status: RunProgress['status'], runId = 'scan-1'): RunProgress {
  return { runId, progress: value, status, message: '' };
}

class FakeSetup {
  /** What each read of the latest scans answers, in order; the last answer repeats. */
  answers: (Run[] | Error)[] = [[]];
  scans = vi.fn<(limit: number) => Observable<Run[]>>(() => {
    const answer = this.answers.length > 1 ? this.answers.shift()! : this.answers[0];
    return answer instanceof Error ? throwError(() => answer) : of(answer);
  });
  launchScan = vi.fn<SetupService['launchScan']>(() => of(run()));
  /** The final row of a run (`GET /api/runs/{id}`). */
  run = vi.fn<SetupService['run']>(() =>
    of(run({ status: 'succeeded', progress: 100, finished_at: '2026-11-27T06:05:00Z' })),
  );
}

/** The run events of Corridas: one stream per `watch`, driven by the test. */
class FakeEvents {
  streams: Subject<RunProgress>[] = [];
  watch = vi.fn<(runId: string) => Observable<RunProgress>>(() => {
    const stream = new Subject<RunProgress>();
    this.streams.push(stream);
    return stream.asObservable();
  });
  get last(): Subject<RunProgress> {
    return this.streams[this.streams.length - 1];
  }
}

async function render(service = new FakeSetup()) {
  const events = new FakeEvents();
  TestBed.configureTestingModule({
    imports: [SetupScanStep],
    providers: [
      { provide: SetupService, useValue: service },
      { provide: RunEventsService, useValue: events },
    ],
  });
  const fixture = TestBed.createComponent(SetupScanStep);
  const finished = vi.fn();
  fixture.componentInstance.finished.subscribe(finished);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = () => element.querySelector('.launch-scan') as HTMLButtonElement;
  const stable = () => fixture.whenStable();
  return { fixture, element, service, events, finished, button, stable };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SetupScanStep', () => {
  it('launches the first scan, follows its stream and reads its final row', async () => {
    const service = new FakeSetup();
    const { fixture, element, events, finished, button, stable } = await render(service);
    expect(service.scans).toHaveBeenCalledWith(1);
    expect(text(element.querySelector('.step-count'))).toBe('Todavía no hay escaneos.');
    expect(text(button())).toBe('Lanzar escaneo simulado');

    button().click();
    await stable();
    expect(service.launchScan).toHaveBeenCalledTimes(1);
    expect(events.watch).toHaveBeenCalledWith('scan-1');
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

    // Each event brings the run's progress and status.
    events.last.next(progress(40, 'running'));
    await stable();
    expect(text(element.querySelector('.scan-status strong'))).toBe('En ejecución');
    expect(text(element.querySelector('.scan-run .item-number'))).toBe('40 %');
    // An event without a known status keeps the status shown.
    events.last.next(progress(45, null));
    await stable();
    expect(text(element.querySelector('.scan-status strong'))).toBe('En ejecución');
    expect(service.run).not.toHaveBeenCalled();

    events.last.next(progress(100, 'succeeded'));
    events.last.complete();
    await stable();
    expect(service.run).toHaveBeenCalledWith('scan-1');
    expect(finished).toHaveBeenCalledTimes(1);
    expect(text(element.querySelector('.scan-status strong'))).toBe('Terminó bien');
    expect((element.querySelector('progress') as HTMLProgressElement).value).toBe(100);
    expect(text(element.querySelector('.scan-run .item-number'))).toBe('100 %');
    expect(text(element.querySelector('[role="status"]'))).toBe('El escaneo terminó bien.');
    expect(text(button())).toBe('Lanzar otro escaneo');
    expect(button().disabled).toBe(false);
    // It never reads the list of scans again to follow it.
    expect(service.scans).toHaveBeenCalledTimes(1);
  });

  it('keeps following a scan that was already running and reports a failure', async () => {
    const service = new FakeSetup();
    service.answers = [[run({ status: 'running', progress: 10 })]];
    service.run.mockReturnValue(of(run({ status: 'failed', progress: 60 })));
    const { element, events, finished, stable } = await render(service);
    expect(events.watch).toHaveBeenCalledWith('scan-1');
    events.last.next(progress(60, 'failed'));
    events.last.complete();
    await stable();
    expect(finished).toHaveBeenCalledTimes(1);
    expect(text(element.querySelector('.scan-status strong'))).toBe('Terminó con error');
    expect(element.querySelector('.scan-run')?.getAttribute('data-status')).toBe('failed');
    expect(text(element.querySelector('[role="status"]'))).toContain('terminó con error');
  });

  it('only shows a finished scan, without following it', async () => {
    const service = new FakeSetup();
    service.answers = [[run({ status: 'succeeded', progress: 100 })]];
    const { element, events, finished } = await render(service);
    expect(events.watch).not.toHaveBeenCalled();
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
    const { fixture, element, button } = await render(service);
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

  it('offers to follow again when the stream fails, and resumes', async () => {
    const service = new FakeSetup();
    service.answers = [[run({ status: 'running', progress: 10 })]];
    const { element, events, finished, stable } = await render(service);
    events.last.error(new ApiError(0, 'network_error', 'No se pudo conectar con el servidor.'));
    await stable();
    expect(text(element.querySelector('[role="alert"]'))).toContain('No se pudo conectar');
    const resume = element.querySelector('[role="alert"] button') as HTMLButtonElement;
    expect(text(resume)).toBe('Volver a consultar');
    resume.click();
    await stable();
    expect(events.watch).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[role="alert"]')).toBeNull();
    events.last.next(progress(100, 'succeeded'));
    events.last.complete();
    await stable();
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it('reports the end the stream gave when the final row cannot be read', async () => {
    const service = new FakeSetup();
    service.answers = [[run({ status: 'running', progress: 10 })]];
    service.run.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Error interno del servidor.')),
    );
    const { element, events, finished, stable } = await render(service);
    events.last.next(progress(100, 'succeeded'));
    events.last.complete();
    await stable();
    expect(finished).toHaveBeenCalledTimes(1);
    expect(text(element.querySelector('.scan-status strong'))).toBe('Terminó bien');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('offers to follow again when neither the stream nor the final row says the scan ended', async () => {
    const service = new FakeSetup();
    service.answers = [[run({ status: 'running', progress: 10 })]];
    service.run.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Error interno del servidor.')),
    );
    const { element, events, finished, stable } = await render(service);
    events.last.complete();
    await stable();
    expect(finished).not.toHaveBeenCalled();
    expect(text(element.querySelector('[role="alert"]'))).toContain('Error interno');
    expect(text(element.querySelector('[role="alert"] button'))).toBe('Volver a consultar');

    // A final row still in progress points to Corridas and can be followed again.
    service.run.mockReturnValue(of(run({ status: 'running', progress: 80 })));
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await stable();
    events.last.complete();
    await stable();
    expect(finished).not.toHaveBeenCalled();
    expect(text(element.querySelector('[role="alert"]'))).toContain(
      'consulta su avance en Corridas',
    );
    expect(text(element.querySelector('.scan-run .item-number'))).toBe('80 %');
  });

  it('treats only queued and running scans as active', () => {
    expect(isActive({ status: 'queued' })).toBe(true);
    expect(isActive({ status: 'running' })).toBe(true);
    expect(isActive({ status: 'succeeded' })).toBe(false);
    expect(isActive({ status: 'failed' })).toBe(false);
  });
});
