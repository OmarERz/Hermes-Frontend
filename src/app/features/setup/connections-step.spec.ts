import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { ConnectionStatus } from '../connections/connection-labels';
import { ConnectionsService } from '../connections/connections.service';
import { SetupConnectionsStep, withFresh } from './connections-step';

function status(overrides: Partial<ConnectionStatus> & Pick<ConnectionStatus, 'name'>) {
  return {
    ok: true,
    latency_ms: 120,
    missing_variable: null,
    message: 'Conexión correcta',
    checked_at: '2026-11-27T06:00:00Z',
    last_ok_at: '2026-11-27T06:00:00Z',
    ...overrides,
  } satisfies ConnectionStatus;
}

// In the API order, which is not the order of the screen.
const STATUSES: ConnectionStatus[] = [
  status({ name: 'nvd', ok: false, latency_ms: 3000, message: 'Sin conexión' }),
  status({
    name: 'deepseek',
    ok: false,
    latency_ms: null,
    missing_variable: 'DEEPSEEK_API_KEY',
    message: 'Variable faltante: DEEPSEEK_API_KEY',
  }),
  status({ name: 'itop', latency_ms: 85 }),
];

class FakeConnections {
  status = vi.fn<() => Observable<ConnectionStatus[]>>(() => of(STATUSES));
  test = vi.fn<ConnectionsService['test']>(() =>
    of([status({ name: 'deepseek', latency_ms: 40 }), status({ name: 'nvd', latency_ms: 50 })]),
  );
}

async function render(service = new FakeConnections()) {
  TestBed.configureTestingModule({
    imports: [SetupConnectionsStep],
    providers: [{ provide: ConnectionsService, useValue: service }],
  });
  const fixture = TestBed.createComponent(SetupConnectionsStep);
  const checked = vi.fn();
  fixture.componentInstance.checked.subscribe(checked);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, element, service, checked };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const names = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('li[data-name]')).map((li) => li.getAttribute('data-name'));

describe('SetupConnectionsStep', () => {
  it('shows a check or a cross per service with its latency and the variable the server lacks, never a key', async () => {
    const { element } = await render();
    expect(names(element)).toEqual(['itop', 'deepseek', 'nvd']);
    expect(text(element.querySelector('.step-count'))).toBe('1 de 3 conexiones funcionan');
    const part = (name: string, selector: string) =>
      text(element.querySelector(`li[data-name="${name}"] ${selector}`));
    expect(
      ['.item-mark', '.item-copy strong', '.item-copy small', '.item-state', '.item-detail'].map(
        (selector) => part('itop', selector),
      ),
    ).toEqual(['', 'iTop', 'CMDB y tickets de iTop', 'Funciona', 'Conexión correcta']);
    // N-16 (F19.8): Lucide icons in the colour of the state, not emoji.
    expect(element.querySelector('li[data-name="itop"] .item-mark svg')).not.toBeNull();
    expect(
      element.querySelector('li[data-name="itop"] .item-mark')?.getAttribute('data-state'),
    ).toBe('ok');
    expect(element.textContent).not.toMatch(/[✅❌]/u);
    expect(part('itop', '.item-number')).toBe('85 ms');
    const deepseek = element.querySelector('li[data-name="deepseek"]') as HTMLElement;
    expect(element.querySelector('li[data-name="deepseek"] .item-mark svg')).not.toBeNull();
    expect(part('deepseek', '.item-state')).toBe('Sin configurar');
    expect(part('deepseek', '.item-number')).toBe('—');
    expect(text(deepseek.querySelector('.item-detail'))).toBe(
      'Falta la variable DEEPSEEK_API_KEY en el servidor',
    );
    expect(deepseek.querySelector('code')?.textContent).toBe('DEEPSEEK_API_KEY');
    expect(text(element.querySelector('li[data-name="nvd"] .item-detail'))).toBe('Sin conexión');
    expect(element.querySelector('input')).toBeNull();
  });

  it('checks every connection again, puts the results in place and tells the wizard', async () => {
    const service = new FakeConnections();
    const answer = new Subject<ConnectionStatus[]>();
    service.test.mockReturnValueOnce(answer);
    const { fixture, element, checked } = await render(service);
    const button = element.querySelector('.step-button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    expect(service.test).toHaveBeenCalledWith(null);
    expect(button.disabled).toBe(true);
    expect(text(button)).toBe('Probando…');
    // A second click while checking does nothing.
    fixture.componentInstance.testAll();
    expect(service.test).toHaveBeenCalledTimes(1);

    answer.next([status({ name: 'deepseek', latency_ms: 40 })]);
    answer.complete();
    await fixture.whenStable();
    expect(button.disabled).toBe(false);
    expect(text(element.querySelector('.step-count'))).toBe('2 de 3 conexiones funcionan');
    expect(text(element.querySelector('li[data-name="deepseek"] .item-number'))).toBe('40 ms');
    expect(checked).toHaveBeenCalledTimes(1);
  });

  it('shows the API message when a check fails, and retries a failed load', async () => {
    const service = new FakeConnections();
    service.status.mockReturnValueOnce(
      throwError(() => new ApiError(503, 'auth_unavailable', 'El servicio no responde.')),
    );
    const { fixture, element, checked } = await render(service);
    expect(text(element.querySelector('[role="alert"]'))).toContain('El servicio no responde.');
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(names(element)).toEqual(['itop', 'deepseek', 'nvd']);

    service.test.mockReturnValueOnce(
      throwError(() => new ApiError(429, 'too_many_requests', 'Demasiadas solicitudes.')),
    );
    (element.querySelector('.step-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(text(element.querySelector('.step-message.error'))).toBe('Demasiadas solicitudes.');
    expect(checked).not.toHaveBeenCalled();
  });

  it('says so when the API reports no connection', async () => {
    const service = new FakeConnections();
    service.status.mockReturnValue(of([]));
    const { element } = await render(service);
    expect(text(element.querySelector('.item-empty'))).toBe('La API no reportó conexiones.');
  });

  it('keeps the screen order and puts a connection it does not know last', () => {
    const merged = withFresh(
      [status({ name: 'nvd' }), status({ name: 'itop' })],
      [status({ name: 'probe' as ConnectionStatus['name'] }), status({ name: 'firebase' })],
    );
    expect(merged.map((item) => item.name)).toEqual(['itop', 'firebase', 'nvd', 'probe']);
  });
});
