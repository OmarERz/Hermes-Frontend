import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { APP_CONFIG } from '../../core/config/app-config';
import { provideFakeSession } from '../../testing/fake-session';
import { CpeMappingDialog } from './cpe-mapping-dialog';
import { KERNEL, PENDING, testConfig } from './inventory.fixtures';
import { InventoryPending, InventoryService } from './inventory.service';
import { PENDING_PAGE } from './pending-counts';
import { PendingInventoryPage } from './pending-inventory.page';

const TOTALS: NonNullable<InventoryPending['totals']> = {
  software_without_cpe: 1,
  without_classification: 0,
  without_exposure: 1,
  without_owner: 1,
  without_custodian: 1,
  outside_delivery_model: 0,
};

class FakeService {
  pending = vi.fn<InventoryService['pending']>(() => of(PENDING));
  cpeCandidates = vi.fn<InventoryService['cpeCandidates']>(() => of([]));
  setMapping = vi.fn<InventoryService['setMapping']>(() =>
    of({ software: KERNEL.id, cpe: 'cpe:2.3:o:amazon:linux_kernel:*:*:*:*:*:*:*:*' }),
  );
}

async function render(
  service = new FakeService(),
  role: Role = 'reader',
  itopBaseUrl: string | null = null,
) {
  TestBed.configureTestingModule({
    imports: [PendingInventoryPage],
    providers: [
      { provide: InventoryService, useValue: service },
      { provide: APP_CONFIG, useValue: testConfig(itopBaseUrl) },
      ...provideFakeSession(role),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(PendingInventoryPage);
  await fixture.whenStable();
  return {
    fixture,
    page: fixture.componentInstance,
    element: fixture.nativeElement as HTMLElement,
  };
}

function dialogOf(fixture: Awaited<ReturnType<typeof render>>['fixture']): CpeMappingDialog {
  return fixture.debugElement.query((node) => node.componentInstance instanceof CpeMappingDialog)
    .componentInstance as CpeMappingDialog;
}

describe('PendingInventoryPage', () => {
  it('counts each kind of pending item and lists the ones that have any', async () => {
    const { element } = await render();
    const cards = Array.from(element.querySelectorAll('.pending-stats .stat-card')).map((card) =>
      card.textContent?.replace(/\s+/g, ' ').trim(),
    );
    // «Fuera del modelo de entrega» is not modelled yet (always empty): no card, no section.
    expect(cards).toEqual([
      'Software sin CPE1',
      'Sin clasificación0',
      'Sin exposición1',
      'Sin responsable1',
      'Sin custodio1',
    ]);
    const titles = Array.from(element.querySelectorAll('section.inventory h2')).map((title) =>
      title.textContent?.trim(),
    );
    expect(titles).toEqual([
      'Software sin CPE',
      'Activos sin dato de exposición',
      'Activos sin responsable',
      'Activos sin custodio',
    ]);
    const owner = element.querySelector('#pending-without_owner tbody tr') as HTMLElement;
    expect(owner.textContent?.replace(/\s+/g, ' ')).toContain('srv-web-03CI-3Sin dueño asignado');
    expect(owner.querySelector('a.row-link')?.getAttribute('href')).toBe('/activos/CI-3');
    expect(element.textContent).toContain('Sus tickets van al equipo custodio por defecto.');
  });

  it('never offers the mapping to a reader', async () => {
    const { element } = await render();
    const software = element.querySelector('#pending-software_without_cpe') as HTMLElement;
    expect(software.textContent).toContain('Amazon Linux 2023 kernel');
    expect(software.querySelector('button')).toBeNull();
  });

  it('lets an analyst map the software and reloads the pending items', async () => {
    const service = new FakeService();
    const { fixture, page, element } = await render(service, 'analyst');
    const button = element.querySelector(
      '#pending-software_without_cpe button.row-action',
    ) as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Mapear CPE');
    button.click();
    await fixture.whenStable();
    // Without `software_product_id` (a backend before F18.6) the product id comes in `ci_id`.
    expect(page.mapping()).toEqual({ id: KERNEL.id, name: KERNEL.name, cpe: null });

    service.pending.mockReturnValue(of({ ...PENDING, software_without_cpe: [] }));
    dialogOf(fixture).saved.emit({
      software: KERNEL.id,
      cpe: 'cpe:2.3:o:amazon:linux_kernel:*:*:*:*:*:*:*:*',
    });
    await fixture.whenStable();
    expect(page.mapping()).toBeNull();
    expect(element.querySelector('.notice')?.textContent).toContain(
      'CPE guardado para Amazon Linux 2023 kernel',
    );
    expect(service.pending).toHaveBeenCalledTimes(2);
    expect(element.querySelector('#pending-software_without_cpe')).toBeNull();

    page.openMapping(PENDING.software_without_cpe[0]!);
    await fixture.whenStable();
    dialogOf(fixture).cancelled.emit();
    await fixture.whenStable();
    expect(page.mapping()).toBeNull();
  });

  it('says when the inventory has nothing pending and when a list is cut', async () => {
    const service = new FakeService();
    service.pending.mockReturnValue(
      of({
        software_without_cpe: [],
        without_classification: [],
        without_exposure: [],
        without_owner: [],
        without_custodian: [],
        outside_delivery_model: [],
      }),
    );
    const { fixture, page, element } = await render(service);
    expect(element.textContent).toContain('No hay pendientes');

    const many = Array.from({ length: PENDING_PAGE }, (_item, index) => ({
      ci_id: `CI-${index}`,
      name: `ci-${index}`,
      detail: 'Sin clasificación de datos',
    }));
    service.pending.mockReturnValue(
      of({
        ...PENDING,
        without_classification: many,
        outside_delivery_model: [{ ci_id: 'CI-9', name: 'ci-9', detail: 'Fuera' }],
      }),
    );
    page.load();
    await fixture.whenStable();
    // Without totals (a backend before F18.6) a full list only says «at least».
    const cut = element.querySelector('#pending-without_classification') as HTMLElement;
    expect(cut.textContent).toContain(`Se muestran los primeros ${PENDING_PAGE}; puede haber más.`);
    expect(cut.querySelector('header > span')?.textContent?.trim()).toBe(`${PENDING_PAGE}+`);
    expect(element.querySelector('#pending-outside_delivery_model')).not.toBeNull();
  });

  it('counts each kind with the API totals and says how much of a cut list it shows', async () => {
    const service = new FakeService();
    const many = Array.from({ length: PENDING_PAGE }, (_item, index) => ({
      ci_id: `CI-${index}`,
      name: `ci-${index}`,
      detail: 'Sin clasificación de datos',
      itop_class: 'Server',
    }));
    service.pending.mockReturnValue(
      of({
        ...PENDING,
        without_classification: many,
        totals: { ...TOTALS, without_classification: 206 },
      }),
    );
    const { element } = await render(service);
    const cards = Array.from(element.querySelectorAll('.pending-stats .stat-card')).map((card) =>
      card.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(cards[1]).toBe('Sin clasificación206');
    const section = element.querySelector('#pending-without_classification') as HTMLElement;
    expect(section.querySelector('header > span')?.textContent?.trim()).toBe('206');
    expect(section.textContent).toContain(`Se muestran los primeros ${PENDING_PAGE} de 206.`);
    expect(section.querySelectorAll('tbody tr')).toHaveLength(PENDING_PAGE);
    // A list that holds all its total is not cut.
    expect(element.querySelector('#pending-without_owner')?.textContent).not.toContain(
      'Se muestran',
    );
  });

  it('maps a software item by its product id, and keeps the old ci_id when it is missing', async () => {
    const service = new FakeService();
    service.pending.mockReturnValue(
      of({
        ...PENDING,
        software_without_cpe: [
          {
            ci_id: KERNEL.id,
            name: KERNEL.name,
            detail: 'Software sin CPE',
            software_product_id: 'product-uuid',
            itop_class: null,
          },
        ],
      }),
    );
    const { fixture, page, element } = await render(service, 'analyst');
    (
      element.querySelector('#pending-software_without_cpe button.row-action') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(page.mapping()).toEqual({ id: 'product-uuid', name: KERNEL.name, cpe: null });
  });

  it('links each CI to its edit form in iTop by its class', async () => {
    const service = new FakeService();
    service.pending.mockReturnValue(
      of({
        ...PENDING,
        without_owner: [
          { ci_id: 'CI-3', name: 'srv-web-03', detail: 'Sin dueño', itop_class: 'Server' },
          { ci_id: 'CI-4', name: 'sin-clase', detail: 'Sin dueño', itop_class: null },
        ],
      }),
    );
    const { element } = await render(service, 'reader', 'https://itop.example.test');
    const rows = element.querySelectorAll('#pending-without_owner tbody tr');
    const edit = rows[0]!.querySelector('.itop-link') as HTMLAnchorElement;
    expect(edit.textContent).toContain('Editar en iTop');
    expect(edit.href).toBe(
      'https://itop.example.test/pages/UI.php?operation=modify&class=Server&id=CI-3',
    );
    // Without its class the console cannot be linked: no link rather than a broken one.
    expect(rows[1]!.querySelector('.itop-link')).toBeNull();
    // The software has no iTop link.
    expect(element.querySelector('#pending-software_without_cpe .itop-link')).toBeNull();
  });

  it('shows the API error with a retry', async () => {
    const service = new FakeService();
    service.pending.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Falló el inventario.')),
    );
    const { fixture, element } = await render(service);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Falló el inventario.');
    service.pending.mockReturnValue(of(PENDING));
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(element.querySelectorAll('section.inventory')).toHaveLength(4);
  });
});
