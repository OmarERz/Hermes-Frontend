import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { formatDateTime, formatShortDateTime } from '../../shared/labels';
import { provideFakeSession } from '../../testing/fake-session';
import {
  connectionDetail,
  connectionState,
  ConnectionStatus,
  formatLatency,
} from './connection-labels';
import { ConnectionsPage, mergeStatuses } from './connections.page';
import { ConnectionsService } from './connections.service';

const CHECKED = '2026-11-24T06:00:00Z';

function status(overrides: Partial<ConnectionStatus> & Pick<ConnectionStatus, 'name'>) {
  return {
    ok: true,
    latency_ms: 120,
    missing_variable: null,
    message: 'Conexión correcta',
    checked_at: CHECKED,
    last_ok_at: CHECKED,
    ...overrides,
  } satisfies ConnectionStatus;
}

const STATUSES: ConnectionStatus[] = [
  status({ name: 'itop', latency_ms: 85 }),
  status({
    name: 'deepseek',
    ok: false,
    latency_ms: null,
    missing_variable: 'DEEPSEEK_API_KEY',
    message: 'Variable faltante: DEEPSEEK_API_KEY',
    last_ok_at: null,
  }),
  status({ name: 'nvd', ok: false, latency_ms: 3000, message: 'Sin conexión' }),
  status({ name: 'abusech' }),
  status({ name: 'ransomwarelive', checked_at: '2026-11-24T05:00:00Z' }),
  status({ name: 'firebase' }),
];

class FakeConnections {
  status = vi.fn<() => Observable<ConnectionStatus[]>>(() => of(STATUSES));
  test = vi.fn<ConnectionsService['test']>((names) =>
    of(
      (names ?? ['itop', 'deepseek', 'nvd', 'abusech', 'ransomwarelive', 'firebase']).map((name) =>
        status({ name, latency_ms: 40, checked_at: '2026-11-24T07:00:00Z' }),
      ),
    ),
  );
}

async function render(role: Role = 'admin', service = new FakeConnections()) {
  TestBed.configureTestingModule({
    imports: [ConnectionsPage],
    providers: [
      provideRouter([]),
      { provide: ConnectionsService, useValue: service },
      ...provideFakeSession(role),
    ],
  });
  const fixture = TestBed.createComponent(ConnectionsPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const stable = () => fixture.whenStable();
  const click = async (selector: string) => {
    element.querySelector<HTMLButtonElement>(selector)!.click();
    await stable();
  };
  return { fixture, element, service, page: fixture.componentInstance, click, stable };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const row = (element: HTMLElement, name: string) =>
  Array.from(element.querySelectorAll(`tr[data-name="${name}"] td`)).map(text);

describe('ConnectionsPage', () => {
  it('groups the services and the data sources, with their state, latency and message', async () => {
    const { element } = await render();
    expect(Array.from(element.querySelectorAll('.connections-panel h2')).map(text)).toEqual([
      'Servicios',
      'Fuentes de datos',
    ]);
    const services = Array.from(
      element.querySelectorAll('.connections-panel')[0].querySelectorAll('tbody tr'),
    ).map((tr) => tr.getAttribute('data-name'));
    expect(services).toEqual(['itop', 'deepseek', 'firebase']);

    expect(row(element, 'itop')).toEqual([
      'iTopCMDB y tickets de iTop',
      '✅ Funciona',
      'Conexión correcta',
      '85 ms',
      formatShortDateTime(CHECKED),
      formatShortDateTime(CHECKED),
      'Probar de nuevo',
    ]);
    // The table cells drop the current year; their title keeps the full date.
    const itopCells = element.querySelectorAll('tr[data-name="itop"] td');
    expect(itopCells[4].getAttribute('title')).toBe(formatDateTime(CHECKED));
    expect(itopCells[5].getAttribute('title')).toBe(formatDateTime(CHECKED));
    // A last success is a one-line date; «never» is a sentence that may wrap.
    expect(itopCells[5].classList).toContain('cell-date');
    const deepseekCells = element.querySelectorAll('tr[data-name="deepseek"] td');
    expect(deepseekCells[5].classList).not.toContain('cell-date');
    expect(row(element, 'deepseek').slice(1, 6)).toEqual([
      '❌ Sin configurar',
      'Variable faltante: DEEPSEEK_API_KEY',
      '—',
      formatShortDateTime(CHECKED),
      'Sin éxito desde que arrancó la API',
    ]);
    expect(row(element, 'nvd').slice(1, 3)).toEqual(['❌ Con falla', 'Sin conexión']);

    expect(Array.from(element.querySelectorAll('.kpi-value')).map(text)).toEqual([
      '6',
      '4',
      '2',
      formatDateTime(CHECKED),
    ]);
    expect(text(element.querySelector('.connections-footnote'))).toContain('nunca se capturan');
  });

  it('checks one connection again and puts its new result in place', async () => {
    const { element, service, click } = await render();
    await click('[aria-label="Probar de nuevo DeepSeek"]');
    expect(service.test).toHaveBeenCalledWith(['deepseek']);
    expect(row(element, 'deepseek').slice(1, 4)).toEqual([
      '✅ Funciona',
      'Conexión correcta',
      '40 ms',
    ]);
    expect(row(element, 'nvd')[1]).toBe('❌ Con falla');
    expect(text(element.querySelector('[role="status"]'))).toBe('Se comprobó DeepSeek de nuevo.');
  });

  it('checks all of them, disabling the buttons until the API answers', async () => {
    const service = new FakeConnections();
    const answer = new Subject<ConnectionStatus[]>();
    service.test.mockReturnValueOnce(answer);
    const { element, page, stable, click } = await render('admin', service);
    await click('.test-all');
    expect(service.test).toHaveBeenCalledWith(null);
    expect(text(element.querySelector('.test-all'))).toBe('Probando todas…');
    expect(element.querySelector<HTMLButtonElement>('.test-all')!.disabled).toBe(true);
    expect(element.querySelector<HTMLButtonElement>('.test-one')!.disabled).toBe(true);
    page.test('itop');
    page.test(null);
    expect(service.test).toHaveBeenCalledTimes(1);

    answer.next(STATUSES.map((item) => ({ ...item, ok: true, missing_variable: null })));
    answer.complete();
    await stable();
    expect(text(element.querySelector('[role="status"]'))).toBe(
      'Se comprobaron todas las conexiones de nuevo.',
    );
    expect(element.querySelector<HTMLButtonElement>('.test-all')!.disabled).toBe(false);
    expect(Array.from(element.querySelectorAll('.kpi-value')).map(text)[1]).toBe('6');
  });

  it('runs single checks side by side and blocks «Probar todas» meanwhile', async () => {
    const service = new FakeConnections();
    const itop = new Subject<ConnectionStatus[]>();
    const nvd = new Subject<ConnectionStatus[]>();
    service.test.mockReturnValueOnce(itop).mockReturnValueOnce(nvd);
    const { element, page, stable } = await render('admin', service);
    page.test('itop');
    page.test('nvd');
    page.test('nvd');
    page.test(null);
    await stable();
    expect(service.test).toHaveBeenCalledTimes(2);
    expect(page.isTesting('itop')).toBe(true);
    expect(page.isTesting('firebase')).toBe(false);

    itop.complete();
    await stable();
    expect(page.isTesting('itop')).toBe(false);
    expect(page.isTesting('nvd')).toBe(true);
    expect(element.querySelector<HTMLButtonElement>('.test-all')!.disabled).toBe(true);
    nvd.complete();
    await stable();
    expect(page.busy()).toBe(false);
  });

  it('shows the API refusal of a check', async () => {
    const service = new FakeConnections();
    service.test.mockReturnValueOnce(
      throwError(() => new ApiError(429, 'too_many_requests', 'Demasiadas solicitudes.')),
    );
    const { element, click } = await render('admin', service);
    await click('[aria-label="Probar de nuevo iTop"]');
    expect(text(element.querySelector('.connections-notice.error'))).toBe(
      'Demasiadas solicitudes.',
    );
    expect(element.querySelector<HTMLButtonElement>('.test-all')!.disabled).toBe(false);
  });

  it('shows a connection the front does not know yet with its raw name', async () => {
    const service = new FakeConnections();
    const slack = { ...status({ name: 'itop' }), name: 'slack' } as unknown as ConnectionStatus;
    service.status.mockReturnValueOnce(of([...STATUSES, slack]));
    const { element, click } = await render('admin', service);
    expect(row(element, 'slack').slice(0, 2)).toEqual(['slack', '✅ Funciona']);
    expect(
      element.querySelectorAll('.connections-panel')[0].querySelectorAll('tbody tr'),
    ).toHaveLength(4);
    service.test.mockReturnValueOnce(of([slack]));
    await click('[aria-label="Probar de nuevo slack"]');
    expect(text(element.querySelector('[role="status"]'))).toBe('Se comprobó slack de nuevo.');
    expect(row(element, 'slack')[0]).toBe('slack');
  });

  it('hides the checks from a role below admin', async () => {
    const { element } = await render('analyst');
    expect(element.querySelector('.test-all')).toBeNull();
    expect(element.querySelector('.test-one')).toBeNull();
    expect(element.querySelectorAll('tbody tr')).toHaveLength(6);
  });

  it('shows the loading state, then the API message with a retry, then an empty list', async () => {
    const service = new FakeConnections();
    const pending = new Subject<ConnectionStatus[]>();
    service.status.mockReturnValueOnce(pending);
    const { element, stable } = await render('admin', service);
    expect(text(element.querySelector('.panel [role="status"]'))).toBe(
      'Cargando el estado de las conexiones…',
    );
    expect(text(element.querySelector('.kpi-value'))).toBe('Cargando…');
    pending.error(new ApiError(403, 'forbidden', 'No tienes permiso para realizar esta acción.'));
    await stable();
    expect(text(element.querySelector('[role="alert"]'))).toContain('No tienes permiso');

    service.status.mockReturnValueOnce(of([]));
    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await stable();
    expect(text(element.querySelector('.state'))).toBe('La API no reportó conexiones.');
    expect(Array.from(element.querySelectorAll('.kpi-value')).map(text)).toEqual([
      '0',
      '0',
      '0',
      'Sin comprobar',
    ]);
  });
});

describe('connection labels', () => {
  it('tells a missing variable from a failure', () => {
    expect(connectionState(status({ name: 'nvd' }))).toBe('ok');
    expect(connectionState(status({ name: 'nvd', ok: false }))).toBe('failing');
    expect(
      connectionState(status({ name: 'nvd', ok: false, missing_variable: 'NVD_API_KEY' })),
    ).toBe('missing');
  });

  it('falls back to a generic detail when the API sends no message', () => {
    expect(connectionDetail(status({ name: 'itop', message: null }))).toBe('Conexión correcta');
    expect(connectionDetail(status({ name: 'itop', ok: false, message: null }))).toBe(
      'Sin detalle',
    );
    expect(
      connectionDetail(
        status({ name: 'itop', ok: false, message: null, missing_variable: 'ITOP_URL' }),
      ),
    ).toBe('Variable faltante: ITOP_URL');
    expect(formatLatency(null)).toBe('—');
    expect(formatLatency(12)).toBe('12 ms');
  });

  it('merges new results in the page order and keeps the others', () => {
    const merged = mergeStatuses(
      [status({ name: 'nvd' }), status({ name: 'itop' })],
      [status({ name: 'firebase', ok: false }), status({ name: 'itop', latency_ms: 1 })],
    );
    expect(merged.map((item) => [item.name, item.latency_ms, item.ok])).toEqual([
      ['itop', 1, true],
      ['firebase', 120, false],
      ['nvd', 120, true],
    ]);
  });
});
