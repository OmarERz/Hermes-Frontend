import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { provideFakeSession } from '../../testing/fake-session';
import { ConfigApi } from './config-api';
import type { SimulationOutcome } from './config-model';
import { FormulaPage } from './formula.page';
import { formulaLabel, formulaLayout } from './formula-layout';
import { configDocument, parameter, SCHEMA } from './testing/config-fixtures';

const PREVIEW: SimulationOutcome = {
  result: {
    changed_findings: 2,
    level_matrix: { high: { critical: 1, high: 3 }, medium: { high: 1, medium: 5 } },
    last_30_days_effect: '2 de 10 hallazgos abiertos cambiarían de nivel con la fórmula propuesta.',
    top_movers: ['CVE-2026-10001 en srv-pagos-01: 70 a 82', 'CVE-2026-2002 en web-01: 55 a 61'],
  },
  notSimulable: [],
};

class FakeConfigApi {
  schema = vi.fn<ConfigApi['schema']>(() => of(SCHEMA));
  config = vi.fn<ConfigApi['config']>(() => of(configDocument()));
  simulate = vi.fn<ConfigApi['simulate']>(() => of(PREVIEW));
  update = vi.fn<ConfigApi['update']>(() => of(configDocument(8, { 'weights.S': '0.30' })));
  versions = vi.fn(() => of({ items: [], nextCursor: null }));
  restore = vi.fn();
}

async function render(role: Role, api = new FakeConfigApi()) {
  TestBed.configureTestingModule({
    imports: [FormulaPage],
    providers: [{ provide: ConfigApi, useValue: api }, ...provideFakeSession(role)],
  });
  const fixture = TestBed.createComponent(FormulaPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as
      HTMLButtonElement | undefined;
  const type = async (key: string, value: string) => {
    const input = element.querySelector(`#cfg-${key.replace(/\./g, '-')}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  return { fixture, element, api, button, type };
}

describe('formula layout', () => {
  it('groups the formula parameters in the documented order with Spanish names', () => {
    const layout = formulaLayout(SCHEMA.filter((param) => param.group === 'formula'));
    expect(layout.weights.map((p) => p.key)).toEqual([
      'weights.S',
      'weights.P',
      'weights.T',
      'weights.A',
      'weights.D',
    ]);
    expect(layout.levels.map((group) => group.name)).toEqual(['P · Explotación']);
    expect(layout.levels[0].parameters.map((p) => p.key)).toEqual([
      'levels.P.kev_or_exploited',
      'levels.P.public_poc',
    ]);
    expect(layout.decay).toEqual([expect.objectContaining({ step: 1, open: false })]);
    expect(layout.others.map((p) => p.key)).toEqual(['formula.kev_exposed_floor']);
  });

  it('keeps the schema description of a key it does not know', () => {
    const unknown = parameter({
      key: 'levels.Z.new',
      group: 'formula',
      description: 'Nuevo nivel',
    });
    expect(formulaLabel(unknown)).toBe('Nuevo nivel');
    expect(formulaLayout([unknown]).levels[0].name).toBe('Z');
    expect(formulaLabel(SCHEMA[0])).toBe('Banda Crítica: puntuación mínima');
  });
});

describe('FormulaPage', () => {
  it('shows every formula parameter of the schema, and only those', async () => {
    const { element } = await render('admin');
    const titles = Array.from(element.querySelectorAll('.formula-grid h2')).map((h) =>
      h.textContent?.trim(),
    );
    expect(titles).toEqual([
      'Pesos',
      'Bandas de urgencia',
      'Niveles de P · Explotación',
      'Decaimiento de la amenaza',
      'Otros parámetros',
    ]);
    expect(element.querySelectorAll('.formula-grid app-config-field').length).toBe(12);
    expect(element.textContent).toContain('Piso KEV + expuesto');
    expect(element.textContent).not.toContain('Zona muerta');
    expect(element.textContent).not.toContain('Presupuesto diario');
    expect(element.querySelector('.weights-total')?.textContent).toContain('1.00');
  });

  it('warns while the weights do not sum 1.0 and blocks the simulation', async () => {
    const { element, button, type } = await render('admin');
    await type('weights.S', '0.30');
    expect(element.querySelector('.weights-total')?.textContent).toContain('1.05');
    expect(element.querySelector('.rule-errors')?.textContent).toContain(
      'Los pesos deben sumar exactamente 1.0.',
    );
    expect(button('Simular')?.disabled).toBe(true);

    await type('weights.P', '0.25');
    expect(element.querySelector('.rule-errors')).toBeNull();
    expect(button('Simular')?.disabled).toBe(false);
  });

  it('marks a value out of range before calling the API', async () => {
    const { element, button, type } = await render('admin');
    await type('formula.kev_exposed_floor', '70');
    expect(element.querySelector('.field-error')?.textContent).toContain(
      'Debe estar entre 80 y 100.',
    );
    expect(button('Simular')?.disabled).toBe(true);
  });

  it('shows the simulation and saves the simulated draft with the version read', async () => {
    const { fixture, element, api, button, type } = await render('admin');
    await type('weights.S', '0.30');
    await type('weights.P', '0.25');
    expect(button('Guardar cambios')?.disabled).toBe(true);

    button('Simular')?.click();
    await fixture.whenStable();
    expect(api.simulate).toHaveBeenCalledWith(
      { 'weights.S': '0.30', 'weights.P': '0.25' },
      new Set(SCHEMA.filter((p) => p.group === 'formula').map((p) => p.key)),
    );
    const panel = element.querySelector('app-simulation-panel') as HTMLElement;
    expect(panel.querySelector('.sim-headline')?.textContent).toContain('2');
    const matrix = Array.from(panel.querySelectorAll('.level-matrix tbody tr')).map((row) =>
      Array.from(row.children).map((cell) => cell.textContent?.trim()),
    );
    expect(matrix).toEqual([
      ['Crítica', '0', '0', '0', '0'],
      ['Alta', '1', '3', '0', '0'],
      ['Media', '0', '1', '5', '0'],
      ['Baja', '0', '0', '0', '0'],
    ]);
    expect(panel.querySelectorAll('.movers li').length).toBe(2);

    button('Guardar cambios')?.click();
    await fixture.whenStable();
    const dialog = element.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Efecto simulado en los hallazgos abiertos');
    expect(dialog.textContent).toContain('Peso S · Severidad');
    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(api.update).toHaveBeenCalledWith({ 'weights.S': '0.30', 'weights.P': '0.25' }, 7);
    expect(element.textContent).toContain('Se encoló el recálculo de las puntuaciones base');
  });

  it('shows the rule the API refused in Spanish', async () => {
    const api = new FakeConfigApi();
    api.simulate.mockReturnValue(
      throwError(
        () =>
          new ApiError(422, 'validation_error', 'La fórmula no es válida.', [
            { field: 'body.changes', issue: 'levels_not_monotonic' },
          ]),
      ),
    );
    const { fixture, element, button, type } = await render('admin', api);
    await type('levels.P.public_poc', '1');
    button('Simular')?.click();
    await fixture.whenStable();
    expect(element.querySelector('.rule-errors')?.textContent).toContain('de mayor a menor');
    expect(element.querySelector('.sim-error')?.textContent).toContain('La fórmula no es válida.');
    expect(button('Guardar cambios')?.disabled).toBe(true);
  });

  it('is read-only for an analyst', async () => {
    const { element, button } = await render('analyst');
    expect(
      Array.from(element.querySelectorAll<HTMLInputElement>('.formula-grid input')).every(
        (input) => input.disabled,
      ),
    ).toBe(true);
    expect(button('Simular')).toBeUndefined();
    expect(button('Guardar cambios')).toBeUndefined();
  });
});
