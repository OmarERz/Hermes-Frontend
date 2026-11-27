import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { PENDING_LIMIT, pendingRows, SetupInventoryStep } from './inventory-step';
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
    // «Fuera del modelo de entrega» is not computed by the API yet: an empty list is not shown as zero.
    expect(rows).toEqual([
      ['Software sin CPE', '2'],
      ['Activos sin clasificación', '1'],
      ['Activos sin dato de exposición', '0'],
      ['Activos sin responsable', '1'],
      ['Activos sin equipo custodio', '0'],
    ]);
    expect(element.querySelectorAll('.item-number.zero').length).toBe(2);
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

  it('reads a list cut at the API limit as «or more», and shows a kind once the API computes it', async () => {
    const service = new FakeSetup();
    service.pendingInventory.mockReturnValueOnce(
      of({
        ...PENDING,
        without_exposure: Array.from({ length: PENDING_LIMIT }, (_, i) => item(`ci-${i}`)),
        outside_delivery_model: [item('ci-x')],
      }),
    );
    const { element } = await render(service);
    expect(text(element.querySelector('.step-count'))).toBe(
      'Al menos 205 pendientes en el inventario',
    );
    expect(text(element.querySelector('li[data-kind="without_exposure"] .item-number'))).toBe(
      '200 o más',
    );
    expect(text(element.querySelector('li[data-kind="outside_delivery_model"] .item-number'))).toBe(
      '1',
    );
    expect(pendingRows(null).map((row) => row.count)).toEqual([0, 0, 0, 0, 0]);
  });

  it('counts past the API limit with the totals, so a cut list reads its exact number', async () => {
    const service = new FakeSetup();
    service.pendingInventory.mockReturnValueOnce(
      of({
        ...PENDING,
        without_exposure: Array.from({ length: PENDING_LIMIT }, (_, i) => item(`ci-${i}`)),
        totals: {
          software_without_cpe: 2,
          without_classification: 1,
          without_exposure: 206,
          without_owner: 1,
          without_custodian: 0,
          outside_delivery_model: 0,
        },
      }),
    );
    const { element } = await render(service);
    expect(text(element.querySelector('.step-count'))).toBe('210 pendientes en el inventario');
    expect(text(element.querySelector('li[data-kind="without_exposure"] .item-number'))).toBe(
      '206',
    );
    // A total below what the list holds never hides an item.
    const rows = pendingRows({
      ...PENDING,
      totals: {
        software_without_cpe: 0,
        without_classification: 0,
        without_exposure: 0,
        without_owner: 0,
        without_custodian: 0,
        outside_delivery_model: 0,
      },
    });
    expect(rows.find((row) => row.kind === 'software_without_cpe')).toMatchObject({
      count: 2,
      capped: false,
    });
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
    expect(element.querySelectorAll('li[data-kind]').length).toBe(5);
  });
});
