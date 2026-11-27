import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { SetupSensitivityStep, weightsOf } from './sensitivity-step';
import { SetupService } from './setup.service';

const VALUES = {
  sensitivity_profile: 'broad',
  dead_zone: '2',
  'weights.D': '0.10',
  'weights.S': '0.25',
  'weights.A': '0.15',
  'weights.P': '0.30',
  'weights.T': '0.20',
  daily_budget_usd: '5',
};

class FakeSetup {
  config = vi.fn<SetupService['config']>(() => of({ version: 12, values: VALUES }));
}

async function render(service = new FakeSetup()) {
  TestBed.configureTestingModule({
    imports: [SetupSensitivityStep],
    providers: [{ provide: SetupService, useValue: service }],
  });
  const fixture = TestBed.createComponent(SetupSensitivityStep);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement, service };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SetupSensitivityStep', () => {
  it('shows the current profile, its dead zone, the version and the weights in formula order', async () => {
    const { element } = await render();
    expect(Array.from(element.querySelectorAll('.step-facts dd')).map(text)).toEqual([
      'Influencia amplia',
      '≤ 2',
      'v12',
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
    expect(text(element.querySelector('.step-hint'))).toContain('junto con su zona muerta');
  });

  it('shows a dash for what the API does not send', async () => {
    const service = new FakeSetup();
    service.config.mockReturnValueOnce(of({ version: 1, values: {} }));
    const { element } = await render(service);
    expect(Array.from(element.querySelectorAll('.step-facts dd')).map(text)).toEqual([
      '—',
      '—',
      'v1',
    ]);
    expect(element.querySelector('.weight-list')).toBeNull();
  });

  it('shows the API message and retries', async () => {
    const service = new FakeSetup();
    service.config.mockReturnValueOnce(
      throwError(() => new ApiError(500, 'internal_error', 'Error interno del servidor.')),
    );
    const { fixture, element } = await render(service);
    expect(text(element.querySelector('[role="alert"]'))).toContain('Error interno del servidor.');
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(text(element.querySelector('.profile-value'))).toBe('Influencia amplia');
  });

  it('puts a weight it does not know last, with its code', () => {
    expect(weightsOf({ 'weights.E': '0.05', 'weights.S': '0.95', other: '1' })).toEqual([
      { factor: 'S', name: 'Severidad', value: '0.95' },
      { factor: 'E', name: 'E', value: '0.05' },
    ]);
  });
});
