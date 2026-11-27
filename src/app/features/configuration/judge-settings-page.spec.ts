import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { provideFakeSession } from '../../testing/fake-session';
import { ConfigApi } from './config-api';
import type { ConfigParameter, SimulationOutcome } from './config-model';
import { JudgeSettingsPage } from './judge-settings.page';
import { configDocument, parameter, SCHEMA } from './testing/config-fixtures';

class FakeConfigApi {
  schema = vi.fn<ConfigApi['schema']>(() => of(SCHEMA));
  config = vi.fn<ConfigApi['config']>(() => of(configDocument()));
  simulate = vi.fn<ConfigApi['simulate']>(() =>
    of<SimulationOutcome>({ result: null, notSimulable: ['sensitivity_profile'] }),
  );
  update = vi.fn<ConfigApi['update']>(() =>
    of(configDocument(8, { sensitivity_profile: 'broad' })),
  );
  versions = vi.fn();
  restore = vi.fn();
}

async function render(role: Role, api = new FakeConfigApi()) {
  TestBed.configureTestingModule({
    imports: [JudgeSettingsPage],
    providers: [
      provideRouter([]),
      { provide: ConfigApi, useValue: api },
      ...provideFakeSession(role),
    ],
  });
  const fixture = TestBed.createComponent(JudgeSettingsPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as
      HTMLButtonElement | undefined;
  const advanced = async () => {
    (element.querySelector('#advanced-mode') as HTMLInputElement).click();
    await fixture.whenStable();
  };
  return { fixture, element, api, button, advanced, page: fixture.componentInstance };
}

describe('JudgeSettingsPage', () => {
  it('builds the profiles and the advanced mode from the judge group of the schema only', async () => {
    const { element, advanced } = await render('admin');
    const profiles = Array.from(element.querySelectorAll('.profile-option strong')).map((s) =>
      s.textContent?.trim(),
    );
    expect(profiles).toEqual(['Influencia mínima', 'Normal', 'Influencia amplia']);
    expect(element.querySelector('.profile-option.selected strong')?.textContent).toContain(
      'Normal',
    );
    expect(element.querySelector('.config-summary')?.textContent).toContain('v7');
    // Locked protections are text with a lock icon (no 🔒 emoji next to it, JUE-3), never controls.
    expect(element.textContent).toContain('Juez sin acciones');
    expect(element.textContent).not.toContain('🔒');
    expect(element.querySelectorAll('.locked-list li svg').length).toBeGreaterThan(0);
    expect(element.querySelector('.locked-summary')).toBeNull();
    expect(element.textContent).not.toContain('Autonomía');

    await advanced();
    const labels = Array.from(
      element.querySelectorAll('app-config-field .tool-copy strong, app-config-field h4 label'),
    ).map((label) => label.textContent?.trim());
    expect(labels).toEqual([
      'Modo de razonamiento',
      'Zona muerta del ajuste del juez',
      'Umbral de doble revisión',
    ]);
    expect(element.textContent).not.toContain('Presupuesto diario');
    expect(element.textContent).not.toContain('Herramientas');
    expect(element.querySelector('.reasons-card')).toBeNull();
  });

  it('shows the reason toggles as soon as the schema lists them', async () => {
    const api = new FakeConfigApi();
    const reasons: ConfigParameter[] = [
      parameter({ key: 'reasons.ransomware.enabled', type: 'boolean', default: 'true' }),
      parameter({ key: 'reasons.zero_day.enabled', type: 'boolean', default: 'false' }),
    ];
    api.schema.mockReturnValue(of([...SCHEMA, ...reasons]));
    const { element, advanced } = await render('admin', api);
    expect(element.querySelector('.config-summary')?.textContent).toContain('1 de 2');
    await advanced();
    const card = element.querySelector('.reasons-card') as HTMLElement;
    expect(card.textContent).toContain('Ransomware');
    expect(card.textContent).toContain('Día cero');
    expect(card.querySelectorAll('input[type="checkbox"]').length).toBe(2);
  });

  it('keeps every control read-only for a reader and hides the save actions', async () => {
    const { element, button, advanced } = await render('reader');
    expect(
      Array.from(element.querySelectorAll<HTMLInputElement>('.profile-option input')).every(
        (input) => input.matches(':disabled'),
      ),
    ).toBe(true);
    expect(button('Guardar cambios')).toBeUndefined();
    expect(button('Simular')).toBeUndefined();
    await advanced();
    expect(
      Array.from(element.querySelectorAll<HTMLInputElement>('app-config-field input')).every(
        (input) => input.disabled,
      ),
    ).toBe(true);
  });

  it('simulates before saving and saves only the change with the version read', async () => {
    const { fixture, element, api, button } = await render('admin');
    element.querySelectorAll<HTMLInputElement>('.profile-option input')[2].click();
    await fixture.whenStable();
    expect(button('Guardar cambios')?.disabled).toBe(true);
    expect(element.textContent).toContain('Simula los cambios antes de guardar');

    button('Simular')?.click();
    await fixture.whenStable();
    // D-091: the profile travels with its dead zone, in the simulation and in the save.
    expect(api.simulate).toHaveBeenCalledWith(
      { sensitivity_profile: 'broad', dead_zone: '2' },
      expect.any(Set),
    );
    expect(element.querySelector('.sim-note')?.textContent).toContain(
      'Perfil de sensibilidad del juez',
    );

    button('Guardar cambios')?.click();
    await fixture.whenStable();
    const dialog = element.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Normal');
    expect(dialog.textContent).toContain('Influencia amplia');
    expect(dialog.textContent).toContain('Sin vista previa');

    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(api.update).toHaveBeenCalledWith({ sensitivity_profile: 'broad', dead_zone: '2' }, 7);
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(element.textContent).toContain('Se guardó la versión 8 de la configuración.');
    expect(element.querySelector('.config-summary')?.textContent).toContain('Influencia amplia');
  });

  it('shows the dead zone of each profile on its card', async () => {
    const { element } = await render('admin');
    expect(
      Array.from(element.querySelectorAll('.profile-dead-zone')).map((s) => s.textContent?.trim()),
    ).toEqual(['Zona muerta: ≤ 6', 'Zona muerta: ≤ 4', 'Zona muerta: ≤ 2']);
  });

  it('takes each profile dead zone from the schema, and drafts none the schema lacks', async () => {
    const withValues = (optionValues: ConfigParameter['option_values']) =>
      SCHEMA.map((param) =>
        param.key === 'sensitivity_profile' ? { ...param, option_values: optionValues } : param,
      );
    const api = new FakeConfigApi();
    api.schema.mockReturnValue(
      of(
        withValues({
          minimal: { dead_zone: '7' },
          broad: { dead_zone: '3', 'judge.range_multiplier': '1.75' },
        }),
      ),
    );
    const { fixture, element, page } = await render('admin', api);
    // «Normal» publishes nothing: no dead zone and no text on its card.
    expect(
      Array.from(element.querySelectorAll('.profile-dead-zone')).map((s) => s.textContent?.trim()),
    ).toEqual(['Zona muerta: ≤ 7', 'Zona muerta: ≤ 3']);
    const broad = element.querySelectorAll('.profile-option')[2];
    expect(broad.querySelector('small')?.textContent).toContain('×1.75');
    element.querySelectorAll<HTMLInputElement>('.profile-option input')[2].click();
    await fixture.whenStable();
    expect(page.editor.changes()).toEqual({ sensitivity_profile: 'broad', dead_zone: '3' });
    // The dead zone came with the profile: not an advanced change.
    expect(page.advancedChanged()).toBe(false);

    TestBed.resetTestingModule();
    const older = new FakeConfigApi();
    older.schema.mockReturnValue(of(withValues(undefined)));
    const second = await render('admin', older);
    expect(second.element.querySelectorAll('.profile-dead-zone')).toHaveLength(0);
    second.element.querySelectorAll<HTMLInputElement>('.profile-option input')[0].click();
    await second.fixture.whenStable();
    // Without the published values the front sends only the profile: the dead zone stays as it is.
    expect(second.page.editor.changes()).toEqual({ sensitivity_profile: 'minimal' });
  });

  it('drafts the dead zone of the chosen profile without opening the advanced mode', async () => {
    const { fixture, element, page } = await render('admin');
    element.querySelectorAll<HTMLInputElement>('.profile-option input')[0].click();
    await fixture.whenStable();
    expect(page.editor.changes()).toEqual({ sensitivity_profile: 'minimal', dead_zone: '6' });
    const toggle = element.querySelector('#advanced-mode') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(toggle.disabled).toBe(false);

    // A dead zone edited by hand is an advanced change: the advanced mode stays open.
    page.editor.set('dead_zone', '7');
    await fixture.whenStable();
    expect(toggle.checked).toBe(true);
    expect(toggle.disabled).toBe(true);
  });

  it('restores the saved dead zone when the saved profile is chosen again', async () => {
    const api = new FakeConfigApi();
    api.config.mockReturnValue(of(configDocument(7, { dead_zone: '5' })));
    const { fixture, element, page, button } = await render('admin', api);
    const options = element.querySelectorAll<HTMLInputElement>('.profile-option input');
    options[2].click();
    await fixture.whenStable();
    expect(page.editor.changes()).toEqual({ sensitivity_profile: 'broad', dead_zone: '2' });

    options[1].click();
    await fixture.whenStable();
    expect(page.editor.changes()).toEqual({});
    expect(button('Simular')?.disabled).toBe(true);
  });

  it('sends only the profile when the API does not publish the dead zone or the profile is unknown', async () => {
    const api = new FakeConfigApi();
    api.schema.mockReturnValue(of(SCHEMA.filter((param) => param.key !== 'dead_zone')));
    const { fixture, element, page } = await render('admin', api);
    element.querySelectorAll<HTMLInputElement>('.profile-option input')[2].click();
    await fixture.whenStable();
    expect(page.editor.changes()).toEqual({ sensitivity_profile: 'broad' });

    TestBed.resetTestingModule();
    const other = new FakeConfigApi();
    other.schema.mockReturnValue(
      of(
        SCHEMA.map((param) =>
          param.key === 'sensitivity_profile'
            ? { ...param, options: [...(param.options ?? []), 'custom'] }
            : param,
        ),
      ),
    );
    const second = await render('admin', other);
    const custom = second.element.querySelectorAll<HTMLInputElement>('.profile-option input')[3];
    expect(custom.value).toBe('custom');
    custom.click();
    await second.fixture.whenStable();
    expect(second.page.editor.changes()).toEqual({ sensitivity_profile: 'custom' });
    expect(second.element.querySelectorAll('.profile-dead-zone').length).toBe(3);
  });

  it('asks to simulate again when the draft changes after simulating', async () => {
    const { fixture, element, button, advanced } = await render('admin');
    await advanced();
    const slider = element.querySelector('#cfg-dead_zone') as HTMLInputElement;
    slider.value = '6';
    slider.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    button('Simular')?.click();
    await fixture.whenStable();
    expect(button('Guardar cambios')?.disabled).toBe(false);

    slider.value = '7';
    slider.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(button('Guardar cambios')?.disabled).toBe(true);
    expect(element.querySelector('.sim-stale')?.textContent).toContain('vuelve a simular');
  });

  it('offers to reload on a version conflict and drops the draft', async () => {
    const api = new FakeConfigApi();
    api.update.mockReturnValue(
      throwError(() => new ApiError(409, 'version_conflict', 'La configuración cambió.')),
    );
    const { fixture, element, button } = await render('admin', api);
    element.querySelectorAll<HTMLInputElement>('.profile-option input')[0].click();
    await fixture.whenStable();
    button('Simular')?.click();
    await fixture.whenStable();
    button('Guardar cambios')?.click();
    await fixture.whenStable();
    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(element.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain(
      'Alguien guardó cambios',
    );

    api.config.mockReturnValue(of(configDocument(9)));
    button('Recargar')?.click();
    await fixture.whenStable();
    expect(api.config).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(element.querySelector('.config-summary')?.textContent).toContain('v9');
    expect(element.querySelector('.profile-option.selected strong')?.textContent).toContain(
      'Normal',
    );
    expect(element.textContent).toContain('Vuelve a aplicar tus cambios');
  });

  it('marks the parameter the API refused and closes the confirmation', async () => {
    const api = new FakeConfigApi();
    api.update.mockReturnValue(
      throwError(
        () =>
          new ApiError(422, 'validation_error', 'Los datos enviados no son válidos.', [
            { field: 'body.changes.dead_zone', issue: 'out_of_range' },
          ]),
      ),
    );
    const { fixture, element, button, advanced } = await render('admin', api);
    await advanced();
    const slider = element.querySelector('#cfg-dead_zone') as HTMLInputElement;
    slider.value = '9';
    slider.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    button('Simular')?.click();
    await fixture.whenStable();
    button('Guardar cambios')?.click();
    await fixture.whenStable();
    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(element.querySelector('.field-error')?.textContent).toContain(
      'Debe estar entre 0 y 10.',
    );
    expect(element.querySelector('.save-notice')?.textContent).toContain('no son válidos');
  });

  it('shows the API message and retries when the configuration cannot be read', async () => {
    const api = new FakeConfigApi();
    api.config.mockReturnValueOnce(
      throwError(() => new ApiError(503, 'auth_unavailable', 'El servicio no responde.')),
    );
    const { fixture, element } = await render('admin', api);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'El servicio no responde.',
    );
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(element.querySelector('.config-summary')).not.toBeNull();
  });
});
