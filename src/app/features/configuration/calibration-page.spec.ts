import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import type { CursorPage } from '../../shared/cursor-pager';
import { provideFakeSession } from '../../testing/fake-session';
import { CalibrationPage } from './calibration.page';
import { ConfigApi } from './config-api';
import type { CalibrationProposal } from './config-model';
import { configDocument, SCHEMA } from './testing/config-fixtures';

const WEIGHTS: CalibrationProposal = {
  id: 'w1',
  created_at: '2026-11-23T08:00:00Z',
  kind: 'formula_weight',
  summary: 'Cambiar los pesos: weights.P 0.30 → 0.35',
  status: 'pending',
  target_key: 'weights.P',
  previous_value: { 'weights.P': '0.30', 'weights.S': '0.25' },
  proposed_value: { 'weights.P': '0.35', 'weights.S': '0.25' },
  evidence: 'Con 42 retroalimentaciones el error medio baja.',
  backtest: { cases: 42, window_days: 30, mae_before: '6.1000', mae_after: '4.2000' },
  decided_at: null,
};

const SOURCE: CalibrationProposal = {
  id: 's1',
  created_at: '2026-11-16T08:00:00Z',
  kind: 'source_level',
  summary: 'Cambiar el nivel de la fuente blog de N2 a N3',
  status: 'rejected',
  target_key: 'source:blog',
  previous_value: { trust_tier: 'N2' },
  proposed_value: { trust_tier: 'N3' },
  evidence: null,
  backtest: null,
  decided_at: '2026-11-17T10:00:00Z',
};

class FakeConfigApi {
  schema = vi.fn<ConfigApi['schema']>(() => of(SCHEMA));
  config = vi.fn<ConfigApi['config']>(() =>
    of(
      configDocument(7, {
        mode4_autonomous: 'false',
        'mode4.weekly_limit': '0.10',
        'mode4.cooldown_weeks': '2',
      }),
    ),
  );
  proposals = vi.fn<ConfigApi['proposals']>(() =>
    of({ items: [WEIGHTS, SOURCE], nextCursor: 'n.sig' }),
  );
  approve = vi.fn<ConfigApi['approve']>(() =>
    of({ ...WEIGHTS, status: 'approved', decided_at: '2026-11-24T09:00:00Z' }),
  );
  reject = vi.fn<ConfigApi['reject']>(() =>
    of({ ...WEIGHTS, status: 'rejected', decided_at: '2026-11-24T09:00:00Z' }),
  );
}

async function render(role: Role, api = new FakeConfigApi()) {
  TestBed.configureTestingModule({
    imports: [CalibrationPage],
    providers: [
      provideRouter([]),
      { provide: ConfigApi, useValue: api },
      ...provideFakeSession(role),
    ],
  });
  const fixture = TestBed.createComponent(CalibrationPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as
      HTMLButtonElement | undefined;
  const click = async (selector: string) => {
    (element.querySelector(selector) as HTMLButtonElement).click();
    await fixture.whenStable();
  };
  return { fixture, element, api, button, click };
}

describe('CalibrationPage', () => {
  it('shows the mode, its limits and where to change them', async () => {
    const { element } = await render('reader');
    const summary = element.querySelector('.config-summary') as HTMLElement;
    expect(summary.textContent).toContain('Supervisada');
    expect(summary.textContent).toContain('±0.10');
    expect(summary.textContent).toContain('2 semanas');
    expect(element.querySelector('.mode-note a')?.getAttribute('href')).toBe('/parametros');
  });

  it('calls the autonomous mode by its name and shows a dash for a missing limit', async () => {
    const api = new FakeConfigApi();
    api.config.mockReturnValue(of(configDocument(7, { mode4_autonomous: 'true' })));
    const { element } = await render('reader', api);
    const summary = element.querySelector('.config-summary') as HTMLElement;
    expect(summary.textContent).toContain('Autónoma');
    expect(summary.textContent).toContain('±—');
  });

  it('lists the proposals with evidence, before and after, and the replay', async () => {
    const { element, api } = await render('reader');
    expect(api.proposals).toHaveBeenCalledWith(null, 10);
    const items = Array.from(element.querySelectorAll('.proposal'));
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Peso de la fórmula');
    expect(items[0].textContent).toContain('Pendiente');
    expect(items[0].textContent).toContain('Con 42 retroalimentaciones');
    expect(items[0].querySelectorAll('tbody tr').length).toBe(1);
    expect(items[0].querySelector('tbody')?.textContent).toContain('0.35');
    expect(items[0].textContent).toContain('Error medio: 6.10 → 4.20 puntos');
    expect(items[1].textContent).toContain('Rechazada');
    expect(items[1].textContent).toContain('Nivel de confianza de la fuente blog');
    expect(items[1].textContent).toContain('Decidida el');
    expect(items[1].querySelector('.evidence')).toBeNull();
  });

  it('lets only an administrator decide', async () => {
    const { element } = await render('analyst');
    expect(element.querySelector('.proposal button')).toBeNull();
    expect(element.textContent).toContain('Espera la decisión de un administrador.');
  });

  it('approves after the before/after confirmation and reads everything again', async () => {
    const { fixture, element, api, button, click } = await render('admin');
    await click(`[aria-label="Aprobar: ${WEIGHTS.summary}"]`);
    const dialog = element.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Aprobar la propuesta');
    expect(dialog.textContent).toContain('0.30');
    expect(dialog.textContent).toContain('0.35');
    expect(dialog.textContent).toContain('versión nueva');

    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(api.approve).toHaveBeenCalledWith('w1');
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Se aprobó y aplicó la propuesta',
    );
    expect(api.config).toHaveBeenCalledTimes(2);
    expect(api.proposals).toHaveBeenCalledTimes(2);
  });

  it('rejects without touching the configuration', async () => {
    const { fixture, element, api, button, click } = await render('admin');
    await click(`[aria-label="Rechazar: ${WEIGHTS.summary}"]`);
    const dialog = element.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Rechazar la propuesta');
    expect(dialog.textContent).toContain('No se aplica ningún cambio.');
    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(api.reject).toHaveBeenCalledWith('w1');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Se rechazó la propuesta',
    );
    expect(api.config).toHaveBeenCalledTimes(1);
    expect(api.proposals).toHaveBeenCalledTimes(2);
  });

  it('cancels a decision without calling the API', async () => {
    const { fixture, element, api, button, click } = await render('admin');
    await click(`[aria-label="Aprobar: ${WEIGHTS.summary}"]`);
    button('Cancelar')?.click();
    await fixture.whenStable();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(api.approve).not.toHaveBeenCalled();
  });

  it('keeps the dialog with the reason when the proposal no longer applies', async () => {
    const api = new FakeConfigApi();
    api.approve.mockReturnValue(
      throwError(
        () =>
          new ApiError(
            409,
            'conflict',
            'La fórmula cambió desde que se hizo la propuesta; ya no aplica.',
          ),
      ),
    );
    const { fixture, element, button, click } = await render('admin', api);
    await click(`[aria-label="Aprobar: ${WEIGHTS.summary}"]`);
    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(element.querySelector('.dialog-error')?.textContent).toContain('ya no aplica');
    expect(api.proposals).toHaveBeenCalledTimes(2);
    expect(button('Confirmar cambios')?.disabled).toBe(false);
  });

  it('does not read the list again on a failure that is not about the proposal', async () => {
    const api = new FakeConfigApi();
    api.reject.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Ocurrió un error en el servidor.')),
    );
    const { fixture, element, button, click } = await render('admin', api);
    await click(`[aria-label="Rechazar: ${WEIGHTS.summary}"]`);
    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(element.querySelector('.dialog-error')?.textContent).toContain(
      'Ocurrió un error en el servidor.',
    );
    expect(api.proposals).toHaveBeenCalledTimes(1);
  });

  it('ignores a second confirm while a decision is saving', async () => {
    const api = new FakeConfigApi();
    const pending = new Subject<CalibrationProposal>();
    api.approve.mockReturnValue(pending);
    const { fixture, click } = await render('admin', api);
    await click(`[aria-label="Aprobar: ${WEIGHTS.summary}"]`);
    const page = fixture.componentInstance;
    page.confirm();
    page.confirm();
    page.cancel();
    expect(api.approve).toHaveBeenCalledTimes(1);
    expect(page.target()).not.toBeNull();
    pending.next({ ...WEIGHTS, status: 'approved' });
    await fixture.whenStable();
    expect(page.target()).toBeNull();
    page.confirm();
    expect(api.approve).toHaveBeenCalledTimes(1);
    expect(page.decisionRows()).toEqual([]);
  });

  it('pages with the cursor of the response', async () => {
    const { api, click } = await render('reader');
    await click('[aria-label="Página siguiente"]');
    expect(api.proposals).toHaveBeenLastCalledWith('n.sig', 10);
    await click('[aria-label="Página anterior"]');
    expect(api.proposals).toHaveBeenLastCalledWith(null, 10);
  });

  it('shows the loading, empty and error states', async () => {
    const api = new FakeConfigApi();
    const pending = new Subject<CursorPage<CalibrationProposal>>();
    api.proposals.mockReturnValueOnce(pending);
    const { fixture, element } = await render('reader', api);
    expect(element.textContent).toContain('Cargando propuestas…');
    pending.next({ items: [], nextCursor: null });
    await fixture.whenStable();
    expect(element.textContent).toContain('Todavía no hay propuestas de calibración.');

    api.proposals.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Ocurrió un error en el servidor.')),
    );
    fixture.componentInstance.pager.reload();
    await fixture.whenStable();
    expect(element.querySelector('.proposals-card [role="alert"]')?.textContent).toContain(
      'Ocurrió un error en el servidor.',
    );
  });

  it('still lists the proposals when the configuration cannot be read', async () => {
    const api = new FakeConfigApi();
    api.config.mockReturnValue(
      throwError(() => new ApiError(503, 'unavailable', 'El servicio no está disponible.')),
    );
    const { element } = await render('reader', api);
    expect(element.querySelector('.config-summary')).toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'El servicio no está disponible.',
    );
    expect(element.querySelectorAll('.proposal').length).toBe(2);
  });
});
