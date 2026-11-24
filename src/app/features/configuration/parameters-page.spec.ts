import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { Role } from '../../core/api/api-types';
import { provideFakeSession } from '../../testing/fake-session';
import { ConfigApi } from './config-api';
import { ParametersPage } from './parameters.page';
import { configDocument, parameter, SCHEMA } from './testing/config-fixtures';

class FakeConfigApi {
  schema = vi.fn<ConfigApi['schema']>(() => of(SCHEMA));
  config = vi.fn<ConfigApi['config']>(() => of(configDocument()));
  simulate = vi.fn<ConfigApi['simulate']>();
  update = vi.fn<ConfigApi['update']>(() =>
    of(configDocument(8, { human_ticket_suggestions: 'false' })),
  );
  versions = vi.fn<ConfigApi['versions']>(() => of({ items: [], nextCursor: null }));
  restore = vi.fn();
}

async function render(role: Role, api = new FakeConfigApi()) {
  TestBed.configureTestingModule({
    imports: [ParametersPage],
    providers: [{ provide: ConfigApi, useValue: api }, ...provideFakeSession(role)],
  });
  const fixture = TestBed.createComponent(ParametersPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as
      HTMLButtonElement | undefined;
  return { fixture, element, api, button };
}

describe('ParametersPage', () => {
  it('shows one card per group, in order, without the formula or the judge', async () => {
    const api = new FakeConfigApi();
    api.schema.mockReturnValue(
      of([...SCHEMA, parameter({ key: 'new.setting', group: 'zeta', description: 'Nuevo' })]),
    );
    const { element } = await render('admin', api);
    const titles = Array.from(element.querySelectorAll('.groups-grid h2')).map((h) =>
      h.textContent?.trim(),
    );
    expect(titles).toEqual(['Notificaciones', 'Tickets', 'Presupuesto', 'zeta']);
    expect(element.textContent).toContain('Nuevo');
    expect(element.textContent).not.toContain('Zona muerta');
    expect(element.textContent).not.toContain('Peso del factor');
    expect(element.querySelector('.config-summary')?.textContent).toContain('4 en 4 grupos');
    expect(element.querySelector('app-simulation-panel')).toBeNull();
  });

  it('lets an analyst change only the parameters of the analyst role', async () => {
    const { element, button } = await render('analyst');
    const suggestions = element.querySelector('#cfg-human_ticket_suggestions') as HTMLInputElement;
    const budget = element.querySelector('#cfg-daily_budget_usd') as HTMLInputElement;
    expect(suggestions.disabled).toBe(false);
    expect(budget.disabled).toBe(true);
    expect(element.textContent).toContain('Lo puede cambiar un analista o un administrador.');
    expect(button('Guardar cambios')).toBeDefined();
    expect(button('Simular')).toBeUndefined();
  });

  it('saves without a simulation, with the version read', async () => {
    const { fixture, element, api, button } = await render('analyst');
    (element.querySelector('#cfg-human_ticket_suggestions') as HTMLInputElement).click();
    await fixture.whenStable();
    expect(button('Guardar cambios')?.disabled).toBe(false);
    button('Guardar cambios')?.click();
    await fixture.whenStable();
    const dialog = element.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Sugerencias en tickets humanos');
    expect(dialog.textContent).toContain('Activado');
    expect(dialog.textContent).toContain('Desactivado');
    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(api.simulate).not.toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith({ human_ticket_suggestions: 'false' }, 7);
    expect(element.textContent).toContain('Se guardó la versión 8 de la configuración.');
    expect(element.textContent).not.toContain('Se encoló el recálculo');
  });

  it('discards the draft', async () => {
    const { fixture, element, button } = await render('admin');
    const select = element.querySelector('#cfg-notifications-consumer') as HTMLSelectElement;
    select.value = 'slack';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(element.querySelector('.config-summary')?.textContent).toContain('1');
    button('Descartar cambios')?.click();
    await fixture.whenStable();
    expect(button('Guardar cambios')?.disabled).toBe(true);
    expect((element.querySelector('#cfg-notifications-consumer') as HTMLSelectElement).value).toBe(
      'log',
    );
  });

  it('shows a blocked parameter with 🔒 and never lets anyone edit it', async () => {
    const api = new FakeConfigApi();
    api.schema.mockReturnValue(
      of([
        parameter({
          key: 'retention.audit_days',
          group: 'retention',
          level: 'blocked',
          min_role: 'reader',
          description: 'Retención de la auditoría',
        }),
        parameter({
          key: 'ui.theme',
          group: 'ui',
          type: 'string',
          min_role: 'reader',
          description: 'Tema',
        }),
      ]),
    );
    const { element } = await render('admin', api);
    expect((element.querySelector('#cfg-retention-audit_days') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(element.textContent).toContain('🔒 Bloqueado');
    expect(element.textContent).toContain('🔒 Retención de la auditoría');
    expect(element.textContent).toContain('Lo puede cambiar cualquier usuario.');
  });

  it('says when the server publishes no other parameter', async () => {
    const api = new FakeConfigApi();
    api.schema.mockReturnValue(of(SCHEMA.filter((p) => p.group === 'formula')));
    const { element } = await render('reader', api);
    expect(element.textContent).toContain('El servidor no publica otros parámetros.');
  });
});
