import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../core/api/api-error';
import { ConfirmChangesDialog } from './confirm-changes-dialog';
import { isVersionConflict, withExpectedVersion } from './versioned-save';

@Component({
  imports: [ConfirmChangesDialog],
  template: `<app-confirm-changes-dialog
    [changes]="changes"
    [error]="error()"
    (confirmed)="events.push('confirm')"
    (cancelled)="events.push('cancel')"
    (reloadRequested)="events.push('reload')"
  />`,
})
class Host {
  readonly changes = [
    { name: 'Peso S', before: '0.25', after: '0.30', impact: 'Sube la severidad.' },
  ];
  readonly error = signal<ApiError | null>(null);
  readonly events: string[] = [];
}

describe('ConfirmChangesDialog', () => {
  it('lists each change before and after, and confirms', async () => {
    const fixture = TestBed.createComponent(Host);
    const element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(element.querySelector('.change-list')?.textContent).toContain('0.25');
    expect(element.querySelector('.change-list')?.textContent).toContain('0.30');
    (element.querySelector('.save-button') as HTMLButtonElement).click();
    expect(fixture.componentInstance.events).toEqual(['confirm']);
  });

  it('offers to reload instead of saving on a version conflict', async () => {
    const fixture = TestBed.createComponent(Host);
    const element = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.error.set(
      new ApiError(409, 'version_conflict', 'La versión cambió.'),
    );
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Alguien guardó cambios mientras editabas',
    );
    const button = element.querySelector('.save-button') as HTMLButtonElement;
    expect(button.textContent).toContain('Recargar');
    button.click();
    expect(fixture.componentInstance.events).toEqual(['reload']);
  });

  it('shows other errors as the API message', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.error.set(
      new ApiError(422, 'validation_error', 'Los datos enviados no son válidos.'),
    );
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Los datos enviados no son válidos.',
    );
  });
});

describe('versioned save helpers', () => {
  it('adds the version that was read', () => {
    expect(withExpectedVersion({ changes: { 'weights.S': '0.3' } }, 4)).toEqual({
      changes: { 'weights.S': '0.3' },
      expected_version: 4,
    });
  });

  it('recognises only the version_conflict code as a conflict', () => {
    expect(isVersionConflict(new ApiError(409, 'version_conflict', 'x'))).toBe(true);
    expect(isVersionConflict(new ApiError(409, 'stale_proposal', 'x'))).toBe(false);
    expect(isVersionConflict(new Error('x'))).toBe(false);
  });
});
