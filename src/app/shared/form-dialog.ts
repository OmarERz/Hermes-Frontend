import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ApiError } from '../core/api/api-error';

let nextId = 0;

/**
 * A small form or confirmation in a native modal `<dialog>` (F17.14, the pattern of the CPE mapping and feedback
 * dialogs): the page behind is inert, Tab stays inside, and closing gives the focus back to the button that opened it.
 * The page projects the fields (the shared `.field` and `.control` of src/styles/forms.css) or the text to confirm;
 * the first field gets the focus, or «Cancelar» when there is none. Escape and «Cancelar» close it, never while a
 * save runs. Enter submits it when `canSubmit` allows.
 */
@Component({
  selector: 'app-form-dialog',
  template: `
    <dialog
      #dialog
      class="form-dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="description() ? descriptionId : null"
      (cancel)="onCancel($event)"
      (close)="onNativeClose()"
    >
      <form class="form-dialog-body" novalidate (submit)="submit($event)">
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
            #cancelButton
            type="button"
            class="btn btn-secondary cancel-button"
            [disabled]="saving()"
            (click)="cancel()"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="btn save-button"
            [class.btn-primary]="!danger()"
            [class.btn-danger]="danger()"
            [disabled]="saving() || !canSubmit()"
            [attr.aria-busy]="saving()"
          >
            {{ saving() ? savingLabel() : submitLabel() }}
          </button>
        </footer>
      </form>
    </dialog>
  `,
  styleUrl: './form-dialog.css',
})
export class FormDialog {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');
  private closed = false;

  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly submitLabel = input('Guardar');
  readonly savingLabel = input('Guardando…');
  /** The action removes or switches something off: the danger button instead of the primary one. */
  readonly danger = input(false);
  readonly saving = input(false);
  readonly canSubmit = input(true);
  readonly error = input<ApiError | null>(null);
  readonly submitted = output<void>();
  readonly cancelled = output<void>();

  readonly titleId = `form-dialog-title-${++nextId}`;
  readonly descriptionId = `form-dialog-description-${nextId}`;

  constructor() {
    afterNextRender(() => {
      this.show();
      const element = this.dialog().nativeElement;
      const field = element.querySelector<HTMLElement>('input, select, textarea');
      (field ?? this.cancelButton().nativeElement).focus();
    });
    // The page removes the dialog once it is done: closing it first gives the focus back to the opener.
    inject(DestroyRef).onDestroy(() => this.closeNative());
  }

  submit(event: Event): void {
    event.preventDefault();
    if (this.saving() || !this.canSubmit()) return;
    this.submitted.emit();
  }

  cancel(): void {
    if (this.saving()) return;
    this.closeNative();
    this.cancelled.emit();
  }

  /** Escape asks to close through the same rule. */
  onCancel(event: Event): void {
    event.preventDefault();
    this.cancel();
  }

  /** The browser closed the modal on its own: it opens again while a save runs, and otherwise counts as a cancel. */
  onNativeClose(): void {
    if (this.closed) return;
    if (this.saving()) {
      this.show();
      return;
    }
    this.closed = true;
    this.cancelled.emit();
  }

  private show(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  private closeNative(): void {
    if (this.closed) return;
    this.closed = true;
    const dialog = this.dialog().nativeElement;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
}
