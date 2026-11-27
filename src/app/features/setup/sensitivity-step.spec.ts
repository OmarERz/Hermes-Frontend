import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { ConfigApi } from '../configuration/config-api';
import type { SimulationOutcome } from '../configuration/config-model';
import { configDocument, SCHEMA } from '../configuration/testing/config-fixtures';
import { SetupSensitivityStep, weightsOf } from './sensitivity-step';

class FakeConfigApi {
  schema = vi.fn<ConfigApi['schema']>(() => of(SCHEMA));
  config = vi.fn<ConfigApi['config']>(() => of(configDocument()));
  simulate = vi.fn<ConfigApi['simulate']>(() =>
    of<SimulationOutcome>({
      result: {
        changed_findings: 2,
        level_matrix: {},
        top_movers: [],
        last_30_days_effect: 'Dos hallazgos cambian de nivel.',
      } as unknown as SimulationOutcome['result'],
      notSimulable: [],
    }),
  );
  update = vi.fn<ConfigApi['update']>(() =>
    of(configDocument(8, { sensitivity_profile: 'broad', dead_zone: '2' })),
  );
  versions = vi.fn();
  restore = vi.fn();
}

async function render(api = new FakeConfigApi(), role: 'admin' | 'reader' = 'admin') {
  TestBed.configureTestingModule({
    imports: [SetupSensitivityStep],
    providers: [{ provide: ConfigApi, useValue: api }, ...provideFakeSession(role)],
  });
  const fixture = TestBed.createComponent(SetupSensitivityStep);
  const saved = vi.fn();
  fixture.componentInstance.saved.subscribe(saved);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.replace(/\s+/g, ' ').trim() === label,
    ) as HTMLButtonElement | undefined;
  const press = async (label: string) => {
    button(label)!.click();
    await fixture.whenStable();
  };
  const radios = () => element.querySelectorAll<HTMLInputElement>('.profile-option input');
  return { fixture, element, api, saved, button, press, radios };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SetupSensitivityStep', () => {
  it('shows the profiles with their dead zone, what is saved and the formula weights', async () => {
    const { element, radios } = await render();
    expect(Array.from(element.querySelectorAll('.profile-option strong')).map(text)).toEqual([
      'Influencia mínima',
      'Normal',
      'Influencia amplia',
    ]);
    expect(Array.from(element.querySelectorAll('.profile-dead-zone')).map(text)).toEqual([
      'Zona muerta: ≤ 6',
      'Zona muerta: ≤ 4',
      'Zona muerta: ≤ 2',
    ]);
    expect(radios()[1].checked).toBe(true);
    expect(Array.from(element.querySelectorAll('.step-facts dd')).map(text)).toEqual([
      'Normal',
      '≤ 4',
      'v7',
    ]);
    expect(
      Array.from(element.querySelectorAll('.weight-list li')).map((li) => [
        text(li.querySelector('strong')),
        text(li.querySelector('.item-number')),
      ]),
    ).toEqual([
      ['S · Severidad', '0.25'],
      ['P · Explotación', '0.30'],
      ['T · Contexto de amenaza', '0.20'],
      ['A · Activo', '0.15'],
      ['D · Sensibilidad de los datos', '0.10'],
    ]);
  });

  it('simulates and saves the chosen profile with its dead zone and the version read', async () => {
    const { fixture, element, api, saved, button, press, radios } = await render();
    radios()[2].click();
    await fixture.whenStable();
    expect(button('Guardar cambios')?.disabled).toBe(true);

    await press('Simular');
    expect(api.simulate).toHaveBeenCalledWith(
      { sensitivity_profile: 'broad', dead_zone: '2' },
      expect.any(Set),
    );
    expect(text(element.querySelector('.sim-headline'))).toContain('2');

    await press('Guardar cambios');
    const dialog = element.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Influencia amplia');
    await press('Confirmar cambios');
    expect(api.update).toHaveBeenCalledWith({ sensitivity_profile: 'broad', dead_zone: '2' }, 7);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(Array.from(element.querySelectorAll('.step-facts dd')).map(text)).toEqual([
      'Influencia amplia',
      '≤ 2',
      'v8',
    ]);
    expect(text(element.querySelector('.save-notice'))).toBe(
      'Se guardó la versión 8 de la configuración.',
    );
  });

  it('keeps the profiles read-only without the admin role', async () => {
    const { radios, button } = await render(new FakeConfigApi(), 'reader');
    expect(Array.from(radios()).every((radio) => radio.matches(':disabled'))).toBe(true);
    expect(button('Guardar cambios')).toBeUndefined();
  });

  it('says so when the server does not publish the profile, and shows a dash for missing values', async () => {
    const api = new FakeConfigApi();
    api.schema.mockReturnValue(of(SCHEMA.filter((param) => param.group !== 'judge')));
    api.config.mockReturnValue(of({ version: 1, values: {} }));
    const { element } = await render(api);
    expect(text(element.querySelector('.step-hint'))).toBe(
      'El servidor no publica el perfil de sensibilidad.',
    );
    expect(Array.from(element.querySelectorAll('.step-facts dd')).map(text)).toEqual([
      '—',
      '—',
      'v1',
    ]);
    expect(element.querySelector('.weight-list')).toBeNull();
  });

  it('shows the API message and retries', async () => {
    const api = new FakeConfigApi();
    api.config.mockReturnValueOnce(
      throwError(() => new ApiError(500, 'internal_error', 'Error interno del servidor.')),
    );
    const { fixture, element, saved } = await render(api);
    expect(text(element.querySelector('[role="alert"]'))).toContain('Error interno del servidor.');
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(text(element.querySelector('.profile-value'))).toBe('Normal');
    expect(saved).not.toHaveBeenCalled();
  });

  it('puts a weight it does not know last, with its code', () => {
    expect(weightsOf({ 'weights.E': '0.05', 'weights.S': '0.95', other: '1' })).toEqual([
      { factor: 'S', name: 'Severidad', value: '0.95' },
      { factor: 'E', name: 'E', value: '0.05' },
    ]);
  });
});
