import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import {
  cnaProblems,
  CpeMappingDialog,
  cpeProblem,
  MappingTarget,
  mappingNotice,
} from './cpe-mapping-dialog';
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
    // F15.9: the API also keeps hardware CPEs.
    expect(cpeProblem('cpe:2.3:h:cisco:asa_5505:*')).toBeNull();
    expect(cpeProblem('cpe:2.3:x:cisco:asa_5505:*')).toContain('El CPE no es válido');
  });

  it('checks the CNA names like the API does: optional, but both, short and printable', () => {
    expect(cnaProblems('', '')).toEqual({});
    expect(cnaProblems('  ', '\ufeff')).toEqual({});
    expect(cnaProblems(' Linux ', 'Linux')).toEqual({});
    expect(cnaProblems('n/a', 'CPython')).toEqual({});
    expect(cnaProblems('Linux', ' ')).toEqual({ product: expect.stringContaining('el producto') });
    expect(cnaProblems('', 'Linux')).toEqual({ vendor: expect.stringContaining('el fabricante') });
    expect(cnaProblems('a'.repeat(200), '😀'.repeat(200))).toEqual({});
    expect(cnaProblems('a'.repeat(201), 'Linux')).toEqual({
      vendor: expect.stringContaining('de 1 a 200 caracteres'),
    });
    expect(cnaProblems('Linux', 'Li\u0085nux')).toEqual({
      product: expect.stringContaining('caracteres de control'),
    });
    expect(cnaProblems('Li\u0007nux', 'Linux').vendor).toContain('caracteres de control');
  });

  it('tells the saved mapping with its CNA names when it has them', () => {
    expect(mappingNotice('nginx', { software: 'x', cpe: 'cpe:2.3:a:f5:nginx:*' })).toBe(
      'CPE guardado para nginx (cpe:2.3:a:f5:nginx:*). Hermes buscará sus vulnerabilidades en el siguiente escaneo.',
    );
    expect(
      mappingNotice('Kernel', {
        software: 'x',
        cpe: 'cpe:2.3:o:linux:linux_kernel:*',
        cna: { vendor: 'Linux', product: 'Linux' },
      }),
    ).toContain('(cpe:2.3:o:linux:linux_kernel:*) y los nombres de CVE.org Linux · Linux.');
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
    // No CNA names typed and none in the mapping: the request leaves `cna` out (the API keeps what it has).
    expect(service.setMapping).toHaveBeenCalledWith(KERNEL.id, KERNEL_CPE, undefined);
    expect(host.saved()).toEqual({ software: KERNEL.id, cpe: KERNEL_CPE });
  });

  it('starts from the CNA names of the mapping and sends the edited ones trimmed', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service, {
      id: KERNEL.id,
      name: KERNEL.name,
      cpe: KERNEL_CPE,
      cna: { vendor: 'Linux', product: 'Linux' },
    });
    const vendor = element.querySelector('input[name="cnaVendor"]') as HTMLInputElement;
    const product = element.querySelector('input[name="cnaProduct"]') as HTMLInputElement;
    expect(vendor.value).toBe('Linux');
    expect(product.value).toBe('Linux');
    expect(element.querySelector('fieldset legend')?.textContent).toContain(
      'Nombres en CVE.org (CNA)',
    );
    expect(element.querySelector('#cna-mapping-help')?.textContent).toContain(
      'Hermes no revisa esa fuente para este producto',
    );
    type(product, '  Linux kernel ');
    (element.querySelector('.cpe-form button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.setMapping).toHaveBeenCalledWith(KERNEL.id, KERNEL_CPE, {
      vendor: 'Linux',
      product: 'Linux kernel',
    });
  });

  it('leaves the CNA names out when the person did not change them', async () => {
    // Another session may have changed them since the dialog opened: resending the old pair would undo that.
    const service = new FakeService();
    const { fixture, element } = await render(service, {
      id: KERNEL.id,
      name: KERNEL.name,
      cpe: 'cpe:2.3:a:linux:linux_kernel:*:*:*:*:*:*:*:*',
      cna: { vendor: 'Linux', product: 'Linux' },
    });
    type(element.querySelector('input[name="cpe"]') as HTMLInputElement, KERNEL_CPE);
    type(element.querySelector('input[name="cnaVendor"]') as HTMLInputElement, ' Linux ');
    (element.querySelector('.cpe-form button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.setMapping).toHaveBeenCalledWith(KERNEL.id, KERNEL_CPE, undefined);
  });

  it('locks the CNA names while a save runs, so what closes the dialog is what was sent', async () => {
    const service = new FakeService();
    service.setMapping.mockReturnValue(NEVER);
    const { fixture, dialog, element } = await render(service);
    const group = element.querySelector('fieldset.cna-fields') as HTMLFieldSetElement;
    expect(group.disabled).toBe(false);
    dialog.cpe.set(KERNEL_CPE);
    dialog.save();
    await fixture.whenStable();
    expect(group.disabled).toBe(true);
  });

  it('removes the CNA names of the mapping when both fields are emptied', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service, {
      id: KERNEL.id,
      name: KERNEL.name,
      cpe: KERNEL_CPE,
      cna: { vendor: 'Linux', product: 'Linux' },
    });
    type(element.querySelector('input[name="cnaVendor"]') as HTMLInputElement, '');
    type(element.querySelector('input[name="cnaProduct"]') as HTMLInputElement, ' ');
    (element.querySelector('.cpe-form button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.setMapping).toHaveBeenCalledWith(KERNEL.id, KERNEL_CPE, null);
  });

  it('refuses one CNA name without the other before calling the API', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service, {
      id: KERNEL.id,
      name: KERNEL.name,
      cpe: KERNEL_CPE,
    });
    const vendor = element.querySelector('input[name="cnaVendor"]') as HTMLInputElement;
    const product = element.querySelector('input[name="cnaProduct"]') as HTMLInputElement;
    type(vendor, 'Linux');
    (element.querySelector('.cpe-form button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.setMapping).not.toHaveBeenCalled();
    expect(element.querySelector('#cna-product-error')?.textContent).toContain(
      'Escribe también el producto',
    );
    expect(product.getAttribute('aria-invalid')).toBe('true');
    expect(product.getAttribute('aria-describedby')).toBe('cna-product-error');
    expect(vendor.getAttribute('aria-invalid')).toBe('false');
    expect(element.querySelector('#cna-vendor-error')).toBeNull();

    type(product, 'Linux');
    await fixture.whenStable();
    expect(element.querySelector('#cna-product-error')).toBeNull();
  });

  it('shows its own text for a CNA name the API refuses', async () => {
    const service = new FakeService();
    service.setMapping.mockReturnValue(
      throwError(
        () =>
          new ApiError(422, 'validation_error', 'Los datos enviados no son válidos.', [
            { field: 'body.cna.vendor', issue: 'string_pattern_mismatch' },
          ]),
      ),
    );
    const { fixture, dialog, element } = await render(service);
    dialog.cpe.set(KERNEL_CPE);
    dialog.cnaVendor.set('Linux');
    dialog.cnaProduct.set('Linux');
    dialog.save();
    await fixture.whenStable();
    expect(element.querySelector('#cna-vendor-error')?.textContent).toContain(
      'El nombre no es válido',
    );
    expect(element.querySelector('#cna-product-error')).toBeNull();
    expect(element.querySelector('[role="alert"]')).toBeNull();
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

  it('opens as a modal dialog and closes once with Cancelar', async () => {
    const { fixture, host, element } = await render();
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(true);
    (element.querySelector('.cpe-form footer button[type="button"]') as HTMLButtonElement).click();
    (element.querySelector('.cpe-form footer button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(host.cancelled()).toBe(1);
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('closes with Escape through the same rule', async () => {
    const { fixture, host, element } = await render();
    const escape = new Event('cancel', { cancelable: true });
    element.querySelector('dialog')?.dispatchEvent(escape);
    await fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(host.cancelled()).toBe(1);
  });

  it('stays open while a save runs, whatever tries to close it', async () => {
    const service = new FakeService();
    service.setMapping.mockReturnValue(NEVER);
    const { fixture, host, dialog, element } = await render(service);
    dialog.cpe.set(KERNEL_CPE);
    dialog.save();
    await fixture.whenStable();
    const native = element.querySelector('dialog') as HTMLDialogElement;
    expect(
      (element.querySelector('.cpe-form footer button[type="button"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    dialog.close();
    native.dispatchEvent(new Event('cancel', { cancelable: true }));
    // The browser may close the modal on its own (a second Escape): it opens again.
    native.removeAttribute('open');
    native.dispatchEvent(new Event('close'));
    await fixture.whenStable();
    expect(host.cancelled()).toBe(0);
    expect(native.hasAttribute('open')).toBe(true);
  });

  it('counts a close by the browser as a cancel when nothing is saving', async () => {
    const { fixture, host, element } = await render();
    const native = element.querySelector('dialog') as HTMLDialogElement;
    native.removeAttribute('open');
    native.dispatchEvent(new Event('close'));
    await fixture.whenStable();
    expect(host.cancelled()).toBe(1);
  });

  it('closes the dialog when the mapping is saved', async () => {
    const { fixture, host, dialog, element } = await render();
    dialog.cpe.set(KERNEL_CPE);
    dialog.save();
    await fixture.whenStable();
    expect(host.saved()).toEqual({ software: KERNEL.id, cpe: KERNEL_CPE });
    expect((element.querySelector('dialog') as HTMLDialogElement).hasAttribute('open')).toBe(false);
    expect(host.cancelled()).toBe(0);
  });
});
