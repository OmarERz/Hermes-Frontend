import { Component, computed, input, output } from '@angular/core';
import { ApiError } from '../core/api/api-error';
import { ChangeRow, isVersionConflict, VERSION_CONFLICT_MESSAGE } from './versioned-save';

/**
 * Before/after confirmation of a versioned save (the prototype's "Confirmar cambios" modal, shared). While the
 * save runs the buttons are disabled; a 409 `version_conflict` replaces the confirm button with "Recargar".
 */
@Component({
  selector: 'app-confirm-changes-dialog',
  template: `
    <div class="modal-backdrop" role="presentation" (click)="cancelled.emit()">
      <section
        class="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-changes-title"
        (click)="$event.stopPropagation()"
        (keydown.escape)="cancelled.emit()"
      >
        <h2 id="confirm-changes-title">{{ title() }}</h2>
        <p>Revisa cada valor antes de guardar.</p>
        <div class="change-list">
          @for (change of changes(); track change.name) {
            <article>
              <h3>{{ change.name }}</h3>
              <div>
                <span
                  >Anterior <strong>{{ change.before }}</strong></span
                >
                <span
                  >Nuevo <strong>{{ change.after }}</strong></span
                >
              </div>
              @if (change.impact) {
                <p>{{ change.impact }}</p>
              }
            </article>
          }
        </div>
        @if (error(); as failure) {
          <p class="dialog-error" role="alert">
            {{ conflict() ? conflictMessage : failure.message }}
          </p>
        }
        <footer>
          <button
            type="button"
            class="cancel-button"
            [disabled]="saving()"
            (click)="cancelled.emit()"
          >
            Cancelar
          </button>
          @if (conflict()) {
            <button type="button" class="save-button" (click)="reloadRequested.emit()">
              Recargar
            </button>
          } @else {
            <button
              type="button"
              class="save-button"
              [disabled]="saving()"
              [attr.aria-busy]="saving()"
              (click)="confirmed.emit()"
            >
              {{ saving() ? 'Guardando…' : 'Confirmar cambios' }}
            </button>
          }
        </footer>
      </section>
    </div>
  `,
  styleUrl: './confirm-changes-dialog.css',
})
export class ConfirmChangesDialog {
  readonly title = input('Confirmar cambios');
  readonly changes = input.required<readonly ChangeRow[]>();
  readonly saving = input(false);
  readonly error = input<ApiError | null>(null);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  readonly reloadRequested = output<void>();

  readonly conflict = computed(() => isVersionConflict(this.error()));
  readonly conflictMessage = VERSION_CONFLICT_MESSAGE;
}
