import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { provideFakeSession } from '../../testing/fake-session';
import { CpeMappingDialog } from './cpe-mapping-dialog';
import { KERNEL, PENDING } from './inventory.fixtures';
import { InventoryService } from './inventory.service';
import { PENDING_PAGE, PendingInventoryPage } from './pending-inventory.page';

class FakeService {
  pending = vi.fn<InventoryService['pending']>(() => of(PENDING));
  cpeCandidates = vi.fn<InventoryService['cpeCandidates']>(() => of([]));
  setMapping = vi.fn<InventoryService['setMapping']>(() =>
    of({ software: KERNEL.id, cpe: 'cpe:2.3:o:amazon:linux_kernel:*:*:*:*:*:*:*:*' }),
  );
}

async function render(service = new FakeService(), role: Role = 'reader') {
  TestBed.configureTestingModule({
    imports: [PendingInventoryPage],
    providers: [
      { provide: InventoryService, useValue: service },
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
    const cards = Array.from(element.querySelectorAll('.pending-stats app-kpi-card')).map(
      (card) =>
        `${card.querySelector('.kpi-label')?.textContent?.trim()}${card.querySelector('.kpi-value')?.textContent?.trim()}`,
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
    // The software items carry the product id in `ci_id`.
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
    expect(element.querySelector('#pending-without_classification')?.textContent).toContain(
      `Se muestran los primeros ${PENDING_PAGE}.`,
    );
    expect(element.querySelector('#pending-outside_delivery_model')).not.toBeNull();
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
