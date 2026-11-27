import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../core/api/api-error';
import { FormDialog } from './form-dialog';

@Component({
  imports: [FormDialog],
  template: `<app-form-dialog
    title="Agregar usuario"
    description="Firebase le enviará un correo."
    submitLabel="Crear usuario"
    savingLabel="Creando…"
    [saving]="saving()"
    [canSubmit]="canSubmit()"
    [error]="error()"
    (submitted)="events.push('submit')"
    (cancelled)="events.push('cancel')"
  >
    <label>Correo <input name="email" /></label>
  </app-form-dialog>`,
})
class Host {
  readonly saving = signal(false);
  readonly canSubmit = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly events: string[] = [];
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, host: fixture.componentInstance, element, settle };
}

function submitButton(element: HTMLElement): HTMLButtonElement {
  return element.querySelector('button[type="submit"]') as HTMLButtonElement;
}

describe('FormDialog', () => {
  it('is a labelled modal that focuses its first field', async () => {
    const { element } = await render();
    const dialog = element.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = element.querySelector(`#${dialog.getAttribute('aria-labelledby')}`);
    expect(title?.textContent).toBe('Agregar usuario');
    const description = element.querySelector(`#${dialog.getAttribute('aria-describedby')}`);
    expect(description?.textContent).toBe('Firebase le enviará un correo.');
    expect(document.activeElement).toBe(element.querySelector('input'));
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

  it('closes with Cancelar, Escape or the backdrop, but not while saving', async () => {
    const { element, host, settle } = await render();
    (element.querySelector('.cancel-button') as HTMLButtonElement).click();
    element
      .querySelector('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    (element.querySelector('.modal-backdrop') as HTMLElement).click();
    expect(host.events).toEqual(['cancel', 'cancel', 'cancel']);
    (element.querySelector('[role="dialog"]') as HTMLElement).click();
    expect(host.events).toHaveLength(3); // a click inside the dialog never closes it
    host.saving.set(true);
    await settle();
    (element.querySelector('.modal-backdrop') as HTMLElement).click();
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(host.events).toHaveLength(3);
    expect(submitButton(element).textContent?.trim()).toBe('Creando…');
    expect(submitButton(element).getAttribute('aria-busy')).toBe('true');
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
