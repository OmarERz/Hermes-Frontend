import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { provideFakeSession } from '../../testing/fake-session';
import { dayBound } from './day-bound';
import type { CursorPage } from '../../shared/cursor-pager';
import { RunEventsService, RunProgress } from './run-events';
import type { Run } from './run-labels';
import { NEWS_DONE, RECALC_FAILED, SCAN_RUNNING, SUMMARY } from './runs.fixtures';
import { RunsPage } from './runs.page';
import { RunsService } from './runs.service';

class FakeRuns {
  list = vi.fn<RunsService['list']>((): Observable<CursorPage<Run>> =>
    of({ items: [SCAN_RUNNING, NEWS_DONE, RECALC_FAILED], nextCursor: 'n.s' }),
  );
  launchScan = vi.fn<RunsService['launchScan']>(() =>
    of({ ...SCAN_RUNNING, id: 'new-run', status: 'queued' as const, progress: 0 }),
  );
  summary = vi.fn<RunsService['summary']>(() => of(SUMMARY));
  /** `GET /api/runs/{id}`: by default, the run as the list gives it. */
  get = vi.fn<RunsService['get']>((id: string) =>
    of([SCAN_RUNNING, NEWS_DONE, RECALC_FAILED].find((run) => run.id === id) ?? SCAN_RUNNING),
  );
}

class FakeEvents {
  streams = new Map<string, Subject<RunProgress>>();
  watch = vi.fn((runId: string) => {
    const stream = new Subject<RunProgress>();
    this.streams.set(runId, stream);
    return stream.asObservable();
  });
}

async function render(runs = new FakeRuns(), role: Role = 'analyst') {
  const events = new FakeEvents();
  TestBed.configureTestingModule({
    imports: [RunsPage],
    providers: [
      { provide: RunsService, useValue: runs },
      { provide: RunEventsService, useValue: events },
      ...provideFakeSession(role),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(RunsPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, page: fixture.componentInstance, element, runs, events, settle };
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function cells(row: Element): string[] {
  return Array.from(row.querySelectorAll('td')).map((cell) => text(cell));
}

describe('RunsPage', () => {
  it('lists the runs with their kind, status, progress, reason and launcher', async () => {
    const { element } = await render();
    const rows = element.querySelectorAll('.runs-table tbody tr');
    expect(rows).toHaveLength(3);
    const [kind, status, progress, , finished, duration, reason, launcher, action] = cells(rows[0]);
    expect([kind, status, progress, finished, duration, reason, launcher, action]).toEqual([
      'Escaneo de vulnerabilidades',
      'En ejecución',
      '40 %',
      'En curso',
      'En curso',
      'Manual',
      'Ana Admin',
      'Seguir en vivo',
    ]);
    expect(rows[0].querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40');
    expect(cells(rows[1])).toContain('3 min 20 s');
    expect(cells(rows[1])).toContain('Agenda');
    expect(cells(rows[1])[7]).toBe('—');
    expect(rows[2].querySelector('.run-status')?.classList).toContain('status-failed');
  });

  it('shows the counts of the last 24 hours', async () => {
    const { element } = await render();
    const values = Array.from(element.querySelectorAll('.stat-card strong')).map((item) =>
      text(item),
    );
    expect(values).toEqual(['1', '2', '14', '3']);
  });

  it('keeps the list when the counts fail and says why', async () => {
    const runs = new FakeRuns();
    runs.summary.mockReturnValue(
      throwError(() => new ApiError(503, 'service_unavailable', 'Telemetría no disponible.')),
    );
    const { element } = await render(runs);
    expect(Array.from(element.querySelectorAll('.stat-card strong')).map((s) => text(s))).toEqual([
      '—',
      '—',
      '—',
      '—',
    ]);
    expect(text(element.querySelector('.runs-notice'))).toContain('Telemetría no disponible.');
    expect(element.querySelectorAll('.runs-table tbody tr')).toHaveLength(3);
  });

  it('filters by kind, status and start date from the first page', async () => {
    const { page, runs, element, settle } = await render();
    page.setKind('scan');
    expect(runs.list).toHaveBeenLastCalledWith(
      { kind: 'scan', status: null, date_from: null, date_to: null },
      null,
      25,
    );
    page.setStatus('failed');
    page.setDateFrom('2026-11-20');
    page.setDateTo('2026-11-21');
    expect(runs.list).toHaveBeenLastCalledWith(
      {
        kind: 'scan',
        status: 'failed',
        date_from: dayBound('2026-11-20', false),
        date_to: dayBound('2026-11-21', true),
      },
      null,
      25,
    );
    await settle();
    const clear = Array.from(element.querySelectorAll('button.more-filter')).find(
      (button) => text(button) === 'Quitar filtros',
    ) as HTMLButtonElement;
    clear.click();
    expect(runs.list).toHaveBeenLastCalledWith(
      { kind: null, status: null, date_from: null, date_to: null },
      null,
      25,
    );
    expect(page.hasFilters()).toBe(false);
  });

  it('applies the filters chosen in the selects', async () => {
    const { element, runs } = await render();
    const [kind, status] = Array.from(
      element.querySelectorAll('.filters select'),
    ) as HTMLSelectElement[];
    kind.value = 'ingestion';
    kind.dispatchEvent(new Event('change'));
    status.value = 'succeeded';
    status.dispatchEvent(new Event('change'));
    expect(runs.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'ingestion', status: 'succeeded' }),
      null,
      25,
    );
  });

  it('pages forward with the cursor as received', async () => {
    const { element, runs, settle } = await render();
    (
      element.querySelector('[aria-label="Página siguiente de corridas"]') as HTMLButtonElement
    ).click();
    await settle();
    expect(runs.list).toHaveBeenLastCalledWith(expect.anything(), 'n.s', 25);
    expect(text(element.querySelector('.inventory > header > span'))).toBe('Página 2');
  });

  it('says when there are no runs, with or without filters', async () => {
    const runs = new FakeRuns();
    runs.list.mockReturnValue(of({ items: [], nextCursor: null }));
    const { element, page, settle } = await render(runs);
    expect(text(element.querySelector('app-async-state'))).toBe('Aún no hay corridas.');
    page.setStatus('failed');
    await settle();
    expect(text(element.querySelector('app-async-state'))).toBe(
      'No hay corridas con estos filtros.',
    );
  });

  it('shows the error of the list with a retry', async () => {
    const runs = new FakeRuns();
    runs.list.mockReturnValueOnce(
      throwError(() => new ApiError(500, 'internal_error', 'Falló la lista.')),
    );
    const { element, settle } = await render(runs);
    expect(text(element.querySelector('[role="alert"]'))).toContain('Falló la lista.');
    (element.querySelector('app-async-state button') as HTMLButtonElement).click();
    await settle();
    expect(element.querySelectorAll('.runs-table tbody tr')).toHaveLength(3);
  });

  it('follows a running run live and reads the list again when it ends', async () => {
    const { element, events, runs, settle, page } = await render();
    const follow = element.querySelector(
      '.runs-table tbody tr .detail-button',
    ) as HTMLButtonElement;
    follow.click();
    await settle();
    expect(events.watch).toHaveBeenCalledWith(SCAN_RUNNING.id);
    const detail = element.querySelector('.run-detail')!;
    expect(text(detail.querySelector('h2'))).toBe('Escaneo de vulnerabilidades');
    expect(text(detail.querySelector('.live-badge'))).toBe('En vivo');
    expect(text(detail.querySelector('.run-id'))).toBe(SCAN_RUNNING.id);

    const stream = events.streams.get(SCAN_RUNNING.id)!;
    stream.next({ runId: SCAN_RUNNING.id, progress: 75, status: 'running', message: 'En curso' });
    await settle();
    expect(detail.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('75');
    const row = element.querySelector('.runs-table tbody tr')!;
    expect(row.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('75');
    expect(row.classList).toContain('selected-row');

    const listed = runs.list.mock.calls.length;
    const counted = runs.summary.mock.calls.length;
    const ended: Run = {
      ...SCAN_RUNNING,
      status: 'succeeded',
      progress: 100,
      finished_at: '2026-11-27T09:02:00Z',
    };
    runs.list.mockReturnValue(of({ items: [ended], nextCursor: null }));
    runs.get.mockReturnValue(of(ended));
    stream.next({
      runId: SCAN_RUNNING.id,
      progress: 100,
      status: 'succeeded',
      message: 'Terminado',
    });
    stream.complete();
    await settle();
    // The page again, and the run itself by its id, apart from the table filters.
    expect(runs.list.mock.calls.length).toBe(listed + 1);
    expect(runs.get).toHaveBeenCalledExactlyOnceWith(SCAN_RUNNING.id);
    expect(runs.summary.mock.calls.length).toBe(counted + 1);
    expect(page.liveState()).toBe('ended');
    expect(text(detail.querySelector('.live-note'))).toBe('La corrida terminó.');
    expect(text(detail.querySelector('.run-status'))).toBe('Terminó bien');
    expect(text(detail.querySelector('.run-facts'))).toContain('2 min');
  });

  it('lets the final row of the API win over the last event when the stream is lost', async () => {
    const { element, events, runs, settle, page } = await render();
    page.select(SCAN_RUNNING);
    const stream = events.streams.get(SCAN_RUNNING.id)!;
    stream.next({ runId: SCAN_RUNNING.id, progress: 40, status: 'running', message: 'En curso' });
    const ended: Run = {
      ...SCAN_RUNNING,
      status: 'succeeded',
      progress: 100,
      finished_at: '2026-11-27T09:05:00Z',
    };
    runs.list.mockReturnValue(of({ items: [ended, NEWS_DONE], nextCursor: null }));
    runs.get.mockReturnValue(of(ended));
    stream.error(new ApiError(0, 'network_error', 'No se pudo conectar con el servidor.'));
    await settle();
    const detail = element.querySelector('.run-detail')!;
    expect(text(detail.querySelector('.run-status'))).toBe('Terminó bien');
    expect(detail.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
    expect(text(detail.querySelector('.run-facts'))).toContain('5 min');
    // The run ended: nothing to follow again.
    expect(detail.querySelector('.live-error button')).toBeNull();
    const row = element.querySelector('.runs-table tbody tr')!;
    expect(text(row.querySelector('.run-status'))).toBe('Terminó bien');
    expect(text(row.querySelector('.detail-button'))).toBe('Ver detalle');
  });

  it('gets the final row of a run that left the table filters when it ended', async () => {
    const { events, runs, settle, page, element } = await render();
    page.setStatus('running');
    page.select(SCAN_RUNNING);
    const ended: Run = {
      ...SCAN_RUNNING,
      status: 'failed',
      progress: 70,
      finished_at: '2026-11-27T09:00:45Z',
    };
    runs.list.mockImplementation((filters) =>
      of({ items: filters.status === 'running' ? [] : [ended], nextCursor: null }),
    );
    runs.get.mockReturnValue(of(ended));
    const stream = events.streams.get(SCAN_RUNNING.id)!;
    stream.next({ runId: SCAN_RUNNING.id, progress: 70, status: 'failed', message: 'Falló' });
    stream.complete();
    await settle();
    expect(element.querySelectorAll('.runs-table tbody tr')).toHaveLength(0);
    const facts = text(element.querySelector('.run-detail .run-facts'));
    expect(facts).toContain('45 s');
    expect(text(element.querySelector('.run-detail .run-status'))).toBe('Terminó con error');
  });

  it('reads a run that was still queued by its id when its stream ends', async () => {
    const { events, runs, page, settle } = await render();
    const queued: Run = {
      ...SCAN_RUNNING,
      id: 'queued-run',
      status: 'queued',
      progress: 0,
      started_at: '',
    };
    page.select(queued);
    runs.get.mockReturnValue(
      of({ ...queued, status: 'succeeded', progress: 100, started_at: SCAN_RUNNING.started_at }),
    );
    const stream = events.streams.get('queued-run')!;
    stream.next({ runId: 'queued-run', progress: 100, status: 'succeeded', message: 'Terminado' });
    stream.complete();
    await settle();
    expect(runs.get).toHaveBeenCalledExactlyOnceWith('queued-run');
    expect(page.detail()?.status).toBe('succeeded');
    expect(page.detail()?.run.started_at).toBe(SCAN_RUNNING.started_at);
  });

  it('keeps the detail it has when the run cannot be read again', async () => {
    const { events, runs, page } = await render();
    page.select(SCAN_RUNNING);
    runs.get.mockReturnValue(throwError(() => new ApiError(404, 'not_found', 'No existe.')));
    const stream = events.streams.get(SCAN_RUNNING.id)!;
    stream.next({ runId: SCAN_RUNNING.id, progress: 100, status: null, message: '' });
    stream.complete();
    expect(runs.get).toHaveBeenCalledExactlyOnceWith(SCAN_RUNNING.id);
    expect(page.detail()?.id).toBe(SCAN_RUNNING.id);
    expect(page.liveState()).toBe('ended');
  });

  it('ignores the final row of a run whose detail was closed meanwhile', async () => {
    const { events, runs, page } = await render();
    page.select(SCAN_RUNNING);
    const answer = new Subject<Run>();
    runs.get.mockReturnValue(answer);
    events.streams.get(SCAN_RUNNING.id)!.complete();
    page.select(NEWS_DONE);
    answer.next({ ...SCAN_RUNNING, status: 'succeeded' });
    expect(page.detail()?.id).toBe(NEWS_DONE.id);
  });

  it('opens a finished run without following it', async () => {
    const { element, events, settle } = await render();
    const buttons = element.querySelectorAll('.runs-table tbody tr .detail-button');
    expect(text(buttons[1])).toBe('Ver detalle');
    (buttons[1] as HTMLButtonElement).click();
    await settle();
    expect(events.watch).not.toHaveBeenCalled();
    const detail = element.querySelector('.run-detail')!;
    expect(text(detail.querySelector('h2'))).toBe('Ingesta de noticias');
    expect(detail.querySelector('.live-badge')).toBeNull();
    expect(text(detail.querySelector('.run-facts'))).toContain('3 min 20 s');
  });

  it('offers to follow again when the stream gives up, and closes the detail', async () => {
    const { element, events, page, settle } = await render();
    page.select(SCAN_RUNNING);
    await settle();
    events.streams
      .get(SCAN_RUNNING.id)!
      .error(new ApiError(0, 'network_error', 'No se pudo conectar con el servidor.'));
    await settle();
    const alert = element.querySelector('.live-error')!;
    expect(text(alert)).toContain('No se pudo conectar con el servidor.');
    (alert.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(events.watch).toHaveBeenCalledTimes(2);
    expect(page.liveState()).toBe('live');

    (element.querySelector('.close-detail') as HTMLButtonElement).click();
    await settle();
    expect(element.querySelector('.run-detail')).toBeNull();
    expect(page.liveState()).toBe('idle');
  });

  it('does not restart the stream when the followed run is selected again', async () => {
    const { page, events } = await render();
    page.select(SCAN_RUNNING);
    page.select(SCAN_RUNNING);
    expect(events.watch).toHaveBeenCalledTimes(1);
  });

  it('stops following a run when another one is opened, ignoring its late end', async () => {
    const { page, events, runs } = await render();
    page.select(SCAN_RUNNING);
    const first = events.streams.get(SCAN_RUNNING.id)!;
    page.select(NEWS_DONE);
    expect(first.observed).toBe(false);
    const listed = runs.list.mock.calls.length;
    first.complete();
    expect(runs.list.mock.calls.length).toBe(listed);
    expect(page.detail()?.id).toBe(NEWS_DONE.id);
  });

  it('launches a scan, says so and follows it from the queue', async () => {
    const { element, runs, events, settle } = await render();
    const launch = element.querySelector('.launch-scan') as HTMLButtonElement;
    expect(text(launch)).toBe('Lanzar escaneo');
    launch.click();
    await settle();
    expect(runs.launchScan).toHaveBeenCalledTimes(1);
    expect(text(element.querySelector('.runs-notice[role="status"]'))).toContain('Escaneo en cola');
    expect(events.watch).toHaveBeenCalledWith('new-run');
    // A run not started yet heads the list: back to the first page.
    expect(runs.list).toHaveBeenLastCalledWith(expect.anything(), null, 25);
    expect(text(element.querySelector('.run-detail .run-status'))).toBe('En cola');
  });

  it('shows why a scan could not be launched', async () => {
    const runs = new FakeRuns();
    runs.launchScan.mockReturnValue(
      throwError(
        () => new ApiError(403, 'forbidden', 'No tienes permiso para realizar esta acción.'),
      ),
    );
    const { element, settle } = await render(runs);
    (element.querySelector('.launch-scan') as HTMLButtonElement).click();
    await settle();
    expect(text(element.querySelector('.runs-notice[role="alert"]'))).toBe(
      'No tienes permiso para realizar esta acción.',
    );
    expect((element.querySelector('.launch-scan') as HTMLButtonElement).disabled).toBe(false);
  });

  it('ignores a second launch while the first one is on its way', async () => {
    const runs = new FakeRuns();
    const pending = new Subject<Run>();
    runs.launchScan.mockReturnValue(pending.asObservable());
    const { page } = await render(runs);
    page.launchScan();
    page.launchScan();
    expect(runs.launchScan).toHaveBeenCalledTimes(1);
    expect(page.launching()).toBe(true);
  });

  it('does not offer to launch a scan to a reader', async () => {
    const { element } = await render(new FakeRuns(), 'reader');
    expect(element.querySelector('.launch-scan')).toBeNull();
  });

  it('stops the stream when the screen closes', async () => {
    const { fixture, page, events } = await render();
    page.select(SCAN_RUNNING);
    const stream = events.streams.get(SCAN_RUNNING.id)!;
    fixture.destroy();
    expect(stream.observed).toBe(false);
  });
});
