import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { SetupInventoryStep } from './inventory-step';
import { InventoryPending, SetupService } from './setup.service';

const item = (id: string) => ({ id, name: id }) as unknown as InventoryPending['without_owner'][0];

const PENDING: InventoryPending = {
  software_without_cpe: [item('openssl'), item('nginx')],
  without_classification: [item('ci-1')],
  without_exposure: [],
  without_owner: [item('ci-2')],
  without_custodian: [],
  outside_delivery_model: [],
};

class FakeSetup {
  pendingInventory = vi.fn<SetupService['pendingInventory']>(() => of(PENDING));
}

async function render(service = new FakeSetup()) {
  TestBed.configureTestingModule({
    imports: [SetupInventoryStep],
    providers: [{ provide: SetupService, useValue: service }],
  });
  const fixture = TestBed.createComponent(SetupInventoryStep);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement, service };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SetupInventoryStep', () => {
  it('counts what the iTop inventory lacks, by kind', async () => {
    const { element } = await render();
    expect(text(element.querySelector('.step-count'))).toBe('4 pendientes en el inventario');
    const rows = Array.from(element.querySelectorAll('li[data-kind]')).map((li) => [
      text(li.querySelector('strong')),
      text(li.querySelector('.item-number')),
    ]);
    expect(rows).toEqual([
      ['Software sin CPE', '2'],
      ['Activos sin clasificación', '1'],
      ['Activos sin dato de exposición', '0'],
      ['Activos sin responsable', '1'],
      ['Activos sin equipo custodio', '0'],
      ['Activos fuera del modelo de entrega', '0'],
    ]);
    expect(element.querySelectorAll('.item-number.zero').length).toBe(3);
    expect(text(element.querySelector('.step-hint'))).toContain('se corrigen en iTop');
  });

  it('says when nothing is pending, and in the singular for one', async () => {
    const service = new FakeSetup();
    service.pendingInventory.mockReturnValueOnce(
      of({ ...PENDING, software_without_cpe: [], without_classification: [], without_owner: [] }),
    );
    const { element } = await render(service);
    expect(text(element.querySelector('.step-count'))).toBe('El inventario no tiene pendientes.');

    TestBed.resetTestingModule();
    const one = new FakeSetup();
    one.pendingInventory.mockReturnValueOnce(
      of({ ...PENDING, software_without_cpe: [], without_classification: [] }),
    );
    const second = await render(one);
    expect(text(second.element.querySelector('.step-count'))).toBe('1 pendiente en el inventario');
  });

  it('shows the API message and retries', async () => {
    const service = new FakeSetup();
    service.pendingInventory.mockReturnValueOnce(
      throwError(() => new ApiError(503, 'auth_unavailable', 'El servicio no responde.')),
    );
    const { fixture, element } = await render(service);
    expect(text(element.querySelector('[role="alert"]'))).toContain('El servicio no responde.');
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.pendingInventory).toHaveBeenCalledTimes(2);
    expect(element.querySelectorAll('li[data-kind]').length).toBe(6);
  });
});
