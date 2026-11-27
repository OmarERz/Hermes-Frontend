import { AfterViewInit, Component, ElementRef, inject, input, output } from '@angular/core';
import { ApiError } from '../core/api/api-error';

let nextId = 0;

/**
 * A small form in a modal (F17.14): the same look as the confirmation of a save (ConfirmChangesDialog), with the fields
 * projected by the page (the shared `.field` and `.control` of src/styles/forms.css). The first field gets the focus;
 * Escape, the backdrop and «Cancelar» close it unless a save is running. Enter submits it when `canSubmit` allows.
 */
@Component({
  selector: 'app-form-dialog',
  template: `
    <div class="modal-backdrop" role="presentation" (click)="cancel()">
      <form
        class="form-dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="description() ? descriptionId : null"
        novalidate
        (click)="$event.stopPropagation()"
        (keydown.escape)="cancel()"
        (submit)="submit($event)"
      >
        <h2 [id]="titleId">{{ title() }}</h2>
        @if (description(); as text) {
          <p [id]="descriptionId">{{ text }}</p>
        }
        <div class="form-dialog-fields"><ng-content /></div>
        @if (error(); as failure) {
          <p class="dialog-error" role="alert">{{ failure.message }}</p>
        }
        <footer>
          <button
            type="button"
            class="btn btn-secondary cancel-button"
            [disabled]="saving()"
            (click)="cancel()"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="btn btn-primary save-button"
            [disabled]="saving() || !canSubmit()"
            [attr.aria-busy]="saving()"
          >
            {{ saving() ? savingLabel() : submitLabel() }}
          </button>
        </footer>
      </form>
    </div>
  `,
  styleUrl: './form-dialog.css',
})
export class FormDialog implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly submitLabel = input('Guardar');
  readonly savingLabel = input('Guardando…');
  readonly saving = input(false);
  readonly canSubmit = input(true);
  readonly error = input<ApiError | null>(null);
  readonly submitted = output<void>();
  readonly cancelled = output<void>();

  readonly titleId = `form-dialog-title-${++nextId}`;
  readonly descriptionId = `form-dialog-description-${nextId}`;

  ngAfterViewInit(): void {
    this.host.nativeElement.querySelector<HTMLElement>('input, select, textarea')?.focus();
  }

  submit(event: Event): void {
    event.preventDefault();
    if (this.saving() || !this.canSubmit()) return;
    this.submitted.emit();
  }

  cancel(): void {
    if (!this.saving()) this.cancelled.emit();
  }
}
