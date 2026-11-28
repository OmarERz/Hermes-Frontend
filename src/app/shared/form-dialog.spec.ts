import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../core/api/api-error';
import { FormDialog } from './form-dialog';

@Component({
  imports: [FormDialog],
  template: `
    <button type="button" id="opener">Abrir</button>
    @if (open()) {
      <app-form-dialog
        title="Agregar usuario"
        description="Firebase le enviará un correo."
        submitLabel="Crear usuario"
        savingLabel="Creando…"
        [danger]="danger()"
        [saving]="saving()"
        [canSubmit]="canSubmit()"
        [error]="error()"
        (submitted)="events.push('submit')"
        (cancelled)="events.push('cancel')"
      >
        @if (withField()) {
          <label>Correo <input name="email" /></label>
        } @else {
          <p>¿Seguro?</p>
        }
      </app-form-dialog>
    }
  `,
})
class Host {
  readonly open = signal(true);
  readonly withField = signal(true);
  readonly danger = signal(false);
  readonly saving = signal(false);
  readonly canSubmit = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly events: string[] = [];
}

async function render(setup: (host: Host) => void = () => undefined) {
  const fixture = TestBed.createComponent(Host);
  setup(fixture.componentInstance);
  fixture.detectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, host: fixture.componentInstance, element, settle };
}

function dialogOf(element: HTMLElement): HTMLDialogElement {
  return element.querySelector('dialog') as HTMLDialogElement;
}

function submitButton(element: HTMLElement): HTMLButtonElement {
  return element.querySelector('button[type="submit"]') as HTMLButtonElement;
}

describe('FormDialog', () => {
  it('is an open, labelled native modal that focuses its first field', async () => {
    const { element } = await render();
    const dialog = dialogOf(element);
    expect(dialog.open || dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = element.querySelector(`#${dialog.getAttribute('aria-labelledby')}`);
    expect(title?.textContent).toBe('Agregar usuario');
    const description = element.querySelector(`#${dialog.getAttribute('aria-describedby')}`);
    expect(description?.textContent).toBe('Firebase le enviará un correo.');
    expect(document.activeElement).toBe(element.querySelector('input'));
  });

  it('focuses Cancelar when there is no field to fill, and marks a destructive action', async () => {
    const { element } = await render((host) => {
      host.withField.set(false);
      host.danger.set(true);
    });
    expect(document.activeElement).toBe(element.querySelector('.cancel-button'));
    expect(submitButton(element).classList).toContain('btn-danger');
    expect(submitButton(element).classList).not.toContain('btn-primary');
  });

  it('submits with the button or Enter only when allowed', async () => {
    const { element, host, settle } = await render();
    submitButton(element).click();
    expect(host.events).toEqual(['submit']);
    host.canSubmit.set(false);
    await settle();
    expect(submitButton(element).disabled).toBe(true);
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(host.events).toEqual(['submit']);
  });

  it('closes with Cancelar or Escape, but not while saving', async () => {
    const { element, host, settle } = await render();
    host.saving.set(true);
    await settle();
    const escape = new Event('cancel', { cancelable: true });
    dialogOf(element).dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(host.events).toEqual([]);
    expect(submitButton(element).textContent?.trim()).toBe('Creando…');
    expect(submitButton(element).getAttribute('aria-busy')).toBe('true');
    host.saving.set(false);
    await settle();
    dialogOf(element).dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(host.events).toEqual(['cancel']);
    expect(dialogOf(element).open || dialogOf(element).hasAttribute('open')).toBe(false);
  });

  it('cancels from the button once', async () => {
    const { element, host } = await render();
    (element.querySelector('.cancel-button') as HTMLButtonElement).click();
    dialogOf(element).dispatchEvent(new Event('close'));
    expect(host.events).toEqual(['cancel']);
  });

  it('reopens when the browser closes it during a save, and counts it as a cancel otherwise', async () => {
    const { element, host, settle } = await render();
    host.saving.set(true);
    await settle();
    const dialog = dialogOf(element);
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
    expect(dialog.open || dialog.hasAttribute('open')).toBe(true);
    expect(host.events).toEqual([]);
    host.saving.set(false);
    await settle();
    dialog.dispatchEvent(new Event('close'));
    expect(host.events).toEqual(['cancel']);
  });

  it('closes itself when the page removes it', async () => {
    const { element, host, settle } = await render();
    const dialog = dialogOf(element);
    host.open.set(false);
    await settle();
    expect(dialog.open || dialog.hasAttribute('open')).toBe(false);
    expect(element.querySelector('dialog')).toBeNull();
    expect(host.events).toEqual([]);
  });

  it('shows why the last attempt failed', async () => {
    const { element, host, settle } = await render();
    host.error.set(new ApiError(409, 'email_exists', 'Ya existe una cuenta con ese correo.'));
    await settle();
    expect(element.querySelector('[role="alert"]')?.textContent).toBe(
      'Ya existe una cuenta con ese correo.',
    );
  });

  it('uses the shared buttons: one primary action and a secondary cancel', async () => {
    const { element } = await render();
    expect(element.querySelectorAll('footer .btn-primary')).toHaveLength(1);
    expect(element.querySelectorAll('footer .btn-secondary')).toHaveLength(1);
  });
});
