import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import type { CompanyProfile } from '../company/company-labels';
import { CompanyService } from '../company/company.service';
import { ConnectionsService } from '../connections/connections.service';
import { makeSource } from '../sources/source-fixtures';
import { SourcesService } from '../sources/sources.service';
import { SCAN_POLLING } from './scan-step';
import type { SetupStep, SetupStepUpdate } from './setup-steps';
import { SetupPage } from './setup.page';
import { SetupService } from './setup.service';

const NAMES = [
  'Conexiones',
  'Perfil de la empresa',
  'Empresas pares',
  'Fuentes',
  'Revisión del inventario',
  'Sensibilidad y fórmula',
  'Primer escaneo',
];

function steps(states: Partial<Record<number, 'done' | 'skipped'>> = {}): SetupStep[] {
  return NAMES.map((name, index) => {
    const n = index + 1;
    return { n, name, done: states[n] === 'done', skipped: states[n] === 'skipped' };
  });
}

class FakeSetup {
  current = steps({ 1: 'done', 3: 'skipped' });
  status = vi.fn<() => Observable<SetupStep[]>>(() => of(this.current));
  mark = vi.fn<(n: number, update: SetupStepUpdate) => Observable<SetupStep>>((n, update) => {
    const known = this.current.find((step) => step.n === n)!;
    const marked = { ...known, done: !!update.done && !update.skipped, skipped: !!update.skipped };
    this.current = this.current.map((step) => (step.n === n ? marked : step));
    return of(marked);
  });
  pendingInventory = vi.fn<SetupService['pendingInventory']>(() =>
    of({
      software_without_cpe: [],
      without_classification: [],
      without_exposure: [],
      without_owner: [],
      without_custodian: [],
      outside_delivery_model: [],
    }),
  );
  config = vi.fn<SetupService['config']>(() =>
    of({ version: 3, values: { sensitivity_profile: 'normal', dead_zone: '4' } }),
  );
  scans = vi.fn<SetupService['scans']>(() => of([]));
  launchScan = vi.fn<SetupService['launchScan']>();
}

const PROFILE: CompanyProfile = {
  sector: 'fintech',
  subsectors: [],
  countries: ['MX'],
  language: 'es',
  version: 2,
};

async function render(setup = new FakeSetup()) {
  TestBed.configureTestingModule({
    imports: [SetupPage],
    providers: [
      provideRouter([]),
      ...provideFakeSession('admin'),
      { provide: SetupService, useValue: setup },
      { provide: SCAN_POLLING, useValue: { intervalMs: 1, maxPolls: 2 } },
      {
        provide: ConnectionsService,
        useValue: { status: () => of([]), test: () => of([]) },
      },
      {
        provide: SourcesService,
        useValue: { listAll: () => of([makeSource()]), update: vi.fn() },
      },
      {
        provide: CompanyService,
        useValue: {
          getProfile: () => of(PROFILE),
          updateProfile: vi.fn(),
          listPeers: () => of({ items: [], nextCursor: null }),
          createPeer: vi.fn(),
          updatePeer: vi.fn(),
          deletePeer: vi.fn(),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(SetupPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const stable = () => fixture.whenStable();
  const button = (label: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('.setup-step button')).find(
      (b) => b.textContent?.replace(/\s+/g, ' ').trim() === label,
    );
  const press = async (label: string) => {
    button(label)!.click();
    await stable();
  };
  const goTo = async (n: number) => {
    element.querySelectorAll<HTMLButtonElement>('.step-link')[n - 1].click();
    await stable();
  };
  return { fixture, element, setup, page: fixture.componentInstance, button, press, goTo, stable };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const title = (element: HTMLElement) => text(element.querySelector('#setup-step-title'));

describe('SetupPage', () => {
  it('lists the seven steps with their state and opens the first pending one', async () => {
    const { element } = await render();
    expect(Array.from(element.querySelectorAll('.step-link strong')).map(text)).toEqual(NAMES);
    expect(
      Array.from(element.querySelectorAll('.step-link')).map((link) =>
        link.getAttribute('data-state'),
      ),
    ).toEqual(['done', 'pending', 'skipped', 'pending', 'pending', 'pending', 'pending']);
    expect(text(element.querySelector('.step-link .step-number'))).toBe('✓');
    expect(Array.from(element.querySelectorAll('.stat-card strong')).map(text)).toEqual([
      '7',
      '1',
      '1',
      '5',
    ]);

    expect(title(element)).toBe('Paso 2 · Perfil de la empresa');
    expect(element.querySelector('.step-link.current')?.getAttribute('aria-current')).toBe('step');
    expect(text(element.querySelector('.step-what'))).toContain('Sector principal');
    expect(text(element.querySelector('.step-skip'))).toContain('no se calculan R3 ni T');
    expect(element.querySelector('app-profile-panel')).not.toBeNull();
    expect(text(element.querySelector('.step-links a'))).toBe('Abrir Empresa');
    expect(element.querySelector('.setup-complete')).toBeNull();
    // The wizard never asks for a key.
    expect(element.querySelector('input[type="password"]')).toBeNull();
    expect(text(element.querySelector('.setup-footnote'))).toContain('Ninguna llave se captura');
  });

  it('shows the content of every step', async () => {
    const { element, goTo } = await render();
    const contents: Record<number, string> = {
      1: 'app-setup-connections-step',
      2: 'app-profile-panel',
      3: 'app-peers-panel',
      4: 'app-setup-sources-step',
      5: 'app-setup-inventory-step',
      6: 'app-setup-sensitivity-step',
      7: 'app-setup-scan-step',
    };
    for (const [n, selector] of Object.entries(contents)) {
      await goTo(Number(n));
      expect(title(element)).toBe(`Paso ${n} · ${NAMES[Number(n) - 1]}`);
      expect(element.querySelector(`.step-body ${selector}`), selector).not.toBeNull();
    }
    expect(Array.from(element.querySelectorAll('.step-links a')).map(text)).toEqual([
      'Ver en Corridas',
    ]);
  });

  it('reads the steps again when another step is opened, keeping the current one', async () => {
    const { element, setup, goTo } = await render();
    const reads = setup.status.mock.calls.length;
    setup.current = steps({ 1: 'done', 2: 'done', 3: 'skipped' });
    await goTo(4);
    expect(setup.status.mock.calls.length).toBeGreaterThan(reads);
    expect(title(element)).toBe('Paso 4 · Fuentes');
    expect(element.querySelectorAll('.step-link')[1].getAttribute('data-state')).toBe('done');
    // Opening the step already open reads nothing.
    const after = setup.status.mock.calls.length;
    await goTo(4);
    expect(setup.status.mock.calls.length).toBe(after);
  });

  it('marks a step done and moves on to the next pending step', async () => {
    const { element, setup, press } = await render();
    await press('Marcar como hecho');
    expect(setup.mark).toHaveBeenCalledWith(2, { done: true, skipped: false });
    expect(title(element)).toBe('Paso 4 · Fuentes');
    expect(text(element.querySelector('.setup-notice[role="status"]'))).toBe(
      '«Perfil de la empresa» quedó como hecho.',
    );
    expect(element.querySelectorAll('.step-link')[1].getAttribute('data-state')).toBe('done');
  });

  it('skips a step, says what that means, and takes the skip back', async () => {
    const { element, setup, press, goTo, button } = await render();
    await goTo(5);
    await press('Omitir paso');
    expect(setup.mark).toHaveBeenCalledWith(5, { done: false, skipped: true });
    expect(text(element.querySelector('.setup-notice[role="status"]'))).toBe(
      'Se omitió «Revisión del inventario». Quedan como pendientes en la pantalla de Pendientes de inventario.',
    );
    expect(title(element)).toBe('Paso 6 · Sensibilidad y fórmula');

    await goTo(3);
    expect(button('Omitir paso')).toBeUndefined();
    expect(button('Marcar como hecho')).toBeUndefined();
    await press('Retomar paso');
    expect(setup.mark).toHaveBeenLastCalledWith(3, { done: false, skipped: false });
    expect(title(element)).toBe('Paso 3 · Empresas pares');
    expect(text(element.querySelector('.step-state'))).toBe('Pendiente');
    expect(text(element.querySelector('.setup-notice[role="status"]'))).toBe(
      '«Empresas pares» volvió a quedar pendiente.',
    );
  });

  it('disables the marks while one is saved and shows the API message when it fails', async () => {
    const setup = new FakeSetup();
    const answer = new Subject<SetupStep>();
    setup.mark.mockReturnValueOnce(answer);
    const { element, page, press, button, stable } = await render(setup);
    await press('Marcar como hecho');
    expect(button('Guardando…')?.disabled).toBe(true);
    expect(button('Omitir paso')?.disabled).toBe(true);
    page.mark('skipped');
    expect(setup.mark).toHaveBeenCalledTimes(1);
    answer.error(new ApiError(403, 'forbidden', 'No tienes permiso para realizar esta acción.'));
    await stable();
    expect(text(element.querySelector('.setup-notice.error'))).toBe(
      'No tienes permiso para realizar esta acción.',
    );
    expect(title(element)).toBe('Paso 2 · Perfil de la empresa');
    expect(button('Marcar como hecho')?.disabled).toBe(false);
  });

  it('moves with Anterior and Siguiente, disabled at the ends', async () => {
    const { element, press, button, goTo } = await render();
    await goTo(1);
    expect(button('Anterior')?.disabled).toBe(true);
    await press('Siguiente');
    expect(title(element)).toBe('Paso 2 · Perfil de la empresa');
    await press('Anterior');
    expect(title(element)).toBe('Paso 1 · Conexiones');
    await goTo(7);
    expect(button('Siguiente')?.disabled).toBe(true);
  });

  it('says when the configuration is complete', async () => {
    const setup = new FakeSetup();
    setup.current = steps({
      1: 'done',
      2: 'done',
      3: 'skipped',
      4: 'done',
      5: 'done',
      6: 'done',
      7: 'done',
    });
    const { element } = await render(setup);
    expect(text(element.querySelector('.setup-complete'))).toContain(
      'La configuración inicial está completa',
    );
    expect(title(element)).toBe('Paso 1 · Conexiones');
  });

  it('keeps the last steps shown when reading them again fails', async () => {
    const { element, setup, goTo } = await render();
    setup.status.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Error interno del servidor.')),
    );
    await goTo(4);
    expect(title(element)).toBe('Paso 4 · Fuentes');
    expect(element.querySelectorAll('.step-link').length).toBe(7);
  });

  it('shows the API message when the steps cannot be read, and retries', async () => {
    const setup = new FakeSetup();
    setup.status.mockReturnValueOnce(
      throwError(
        () => new ApiError(403, 'forbidden', 'No tienes permiso para realizar esta acción.'),
      ),
    );
    const { element, stable } = await render(setup);
    expect(Array.from(element.querySelectorAll('.stat-card strong')).map(text)).toEqual([
      '—',
      '—',
      '—',
      '—',
    ]);
    expect(text(element.querySelector('[role="alert"]'))).toContain('No tienes permiso');
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await stable();
    expect(title(element)).toBe('Paso 2 · Perfil de la empresa');
  });

  it('shows a step the front does not know with its name only', async () => {
    const setup = new FakeSetup();
    setup.current = [{ n: 8, name: 'Paso nuevo', done: false, skipped: false }];
    const { element } = await render(setup);
    expect(title(element)).toBe('Paso 8 · Paso nuevo');
    expect(text(element.querySelector('.step-what'))).toContain('todavía no tiene contenido');
    expect(element.querySelector('.step-body')?.children.length).toBe(0);
    expect(element.querySelector('.step-links')).toBeNull();
  });

  it('says so when the API reports no step', async () => {
    const setup = new FakeSetup();
    setup.current = [];
    const { element } = await render(setup);
    expect(text(element.querySelector('.step-empty'))).toBe('La API no reportó pasos.');
    expect(element.querySelector('.setup-step')).toBeNull();
    expect(element.querySelector('.setup-complete')).toBeNull();
  });
});
