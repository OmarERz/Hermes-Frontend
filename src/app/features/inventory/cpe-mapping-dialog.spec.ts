import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { CpeMappingDialog, cpeProblem, MappingTarget } from './cpe-mapping-dialog';
import { KERNEL, OPENSSL } from './inventory.fixtures';
import { InventoryService, Mapping } from './inventory.service';

const KERNEL_CPE = 'cpe:2.3:o:amazon:linux_kernel:*:*:*:*:*:*:*:*';

class FakeService {
  cpeCandidates = vi.fn<InventoryService['cpeCandidates']>(() =>
    of([
      { cpe: KERNEL_CPE, title: 'Amazon Linux kernel', score: 0.67 },
      { cpe: 'cpe:2.3:o:linux:linux_kernel:*:*:*:*:*:*:*:*', title: 'Linux kernel', score: 0.5 },
    ]),
  );
  setMapping = vi.fn<InventoryService['setMapping']>(() =>
    of({ software: KERNEL.id, cpe: KERNEL_CPE }),
  );
}

@Component({
  imports: [CpeMappingDialog],
  template: `<app-cpe-mapping-dialog
    [software]="target()"
    (saved)="saved.set($event)"
    (cancelled)="cancelled.set(cancelled() + 1)"
  />`,
})
class Host {
  readonly target = signal<MappingTarget>({ id: KERNEL.id, name: KERNEL.name, cpe: null });
  readonly saved = signal<Mapping | null>(null);
  readonly cancelled = signal(0);
}

async function render(service = new FakeService(), target?: MappingTarget) {
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [{ provide: InventoryService, useValue: service }],
  });
  const fixture = TestBed.createComponent(Host);
  if (target) fixture.componentInstance.target.set(target);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const dialog = fixture.debugElement.children[0]!.componentInstance as CpeMappingDialog;
  return { fixture, host: fixture.componentInstance, dialog, element };
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('CpeMappingDialog', () => {
  it('checks a typed CPE like the API does', () => {
    expect(cpeProblem('')).toContain('Elige un candidato');
    expect(cpeProblem('openssl')).toContain('El CPE no es válido');
    expect(cpeProblem('cpe:2.3:a:*:openssl:*')).toContain('El CPE no es válido');
    expect(cpeProblem(KERNEL_CPE)).toBeNull();
    expect(cpeProblem('cpe:2.3:a:open\\:ssl:openssl:*')).toBeNull();
  });

  it('searches candidates with the software name as soon as it opens', async () => {
    const service = new FakeService();
    const { element } = await render(service);
    expect(service.cpeCandidates).toHaveBeenCalledWith('Amazon Linux 2023 kernel');
    const candidates = Array.from(element.querySelectorAll('.candidate-list button')).map(
      (button) => button.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(candidates).toEqual([
      `Amazon Linux kernel${KERNEL_CPE}Coincidencia 67 %`,
      'Linux kernelcpe:2.3:o:linux:linux_kernel:*:*:*:*:*:*:*:*Coincidencia 50 %',
    ]);
    expect(element.querySelector('h2')?.textContent).toContain('Amazon Linux 2023 kernel');
  });

  it('saves the picked candidate for the software id', async () => {
    const service = new FakeService();
    const { fixture, host, element } = await render(service);
    (element.querySelector('.candidate-list button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect((element.querySelector('input[name="cpe"]') as HTMLInputElement).value).toBe(KERNEL_CPE);
    expect(element.querySelector('.candidate-list button')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    (element.querySelector('.cpe-form button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.setMapping).toHaveBeenCalledWith(KERNEL.id, KERNEL_CPE);
    expect(host.saved()).toEqual({ software: KERNEL.id, cpe: KERNEL_CPE });
  });

  it('starts from the current CPE and refuses an invalid one before calling the API', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service, {
      id: OPENSSL.id,
      name: OPENSSL.name,
      cpe: OPENSSL.cpe,
    });
    const input = element.querySelector('input[name="cpe"]') as HTMLInputElement;
    expect(input.value).toBe(OPENSSL.cpe);
    type(input, 'openssl');
    (element.querySelector('.cpe-form button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.setMapping).not.toHaveBeenCalled();
    expect(element.querySelector('#cpe-mapping-error')?.textContent).toContain(
      'El CPE no es válido',
    );
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows its own text for a CPE the API refuses and the API message otherwise', async () => {
    const service = new FakeService();
    service.setMapping.mockReturnValue(
      throwError(
        () =>
          new ApiError(422, 'validation_error', 'Los datos enviados no son válidos.', [
            { field: 'body.cpe', issue: 'string_pattern_mismatch' },
          ]),
      ),
    );
    const { fixture, dialog, element } = await render(service);
    dialog.cpe.set(KERNEL_CPE);
    dialog.save();
    await fixture.whenStable();
    expect(element.querySelector('#cpe-mapping-error')?.textContent).toContain(
      'El CPE no es válido',
    );

    service.setMapping.mockReturnValue(
      throwError(() => new ApiError(403, 'forbidden', 'No tienes permiso para mapear.')),
    );
    dialog.save();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No tienes permiso para mapear.',
    );
    dialog.pick({ cpe: KERNEL_CPE, title: 'x', score: 1 });
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('does not save twice while a save runs', async () => {
    const service = new FakeService();
    service.setMapping.mockReturnValue(NEVER);
    const { fixture, dialog, element } = await render(service);
    dialog.cpe.set(KERNEL_CPE);
    dialog.save();
    dialog.save();
    await fixture.whenStable();
    expect(service.setMapping).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.cpe-form button[type="submit"]')?.textContent).toContain(
      'Guardando…',
    );
  });

  it('asks for at least two characters and says when nothing matches', async () => {
    const service = new FakeService();
    service.cpeCandidates.mockReturnValue(of([]));
    const { fixture, dialog, element } = await render(service, { id: KERNEL.id, name: 'X' });
    expect(service.cpeCandidates).not.toHaveBeenCalled();
    dialog.search();
    await fixture.whenStable();
    expect(element.textContent).toContain('Escribe al menos 2 caracteres para buscar.');

    type(element.querySelector('input[name="query"]') as HTMLInputElement, 'kernel');
    (element.querySelector('.search-row button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.cpeCandidates).toHaveBeenCalledWith('kernel');
    expect(element.textContent).toContain('No hay candidatos para esta búsqueda');
  });

  it('shows a failed search with its retry', async () => {
    const service = new FakeService();
    service.cpeCandidates.mockReturnValue(
      throwError(() => new ApiError(503, 'service_unavailable', 'NVD no responde.')),
    );
    const { element } = await render(service);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('NVD no responde.');
  });

  it('closes with Cancelar, Escape or a click outside, but not with a click inside', async () => {
    const { fixture, host, element } = await render();
    const modal = element.querySelector('.mapping-modal') as HTMLElement;
    modal.click();
    expect(host.cancelled()).toBe(0);
    (element.querySelector('.modal-backdrop') as HTMLElement).click();
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    (element.querySelector('.cpe-form footer button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(host.cancelled()).toBe(3);
  });
});
