import { Component, computed, input } from '@angular/core';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { ACTION_ROLES } from '../../core/auth/roles';
import { ConfirmChangesDialog } from '../../shared/confirm-changes-dialog';
import type { ConfigEditor } from './config-editor';

/**
 * The prototype's save row for a ConfigEditor: the result of the last action, "Descartar", "Simular" (admin, when
 * the screen simulates) and "Guardar cambios", which opens the shared before/after confirmation. The actions show
 * only for the role that can save a parameter of the screen; a 409 in the dialog offers to reload.
 */
@Component({
  selector: 'app-config-save-bar',
  imports: [ConfirmChangesDialog, IfRoleDirective],
  template: `
    <div class="save-row">
      <p class="save-notice" role="status">{{ editor().notice() }}</p>
      @if (editor().saveRole(); as minimum) {
        <ng-container *appIfRole="minimum">
          <button
            type="button"
            class="btn btn-secondary cancel-button"
            [disabled]="!editor().changeCount() || editor().saving()"
            (click)="editor().discard()"
          >
            Descartar cambios
          </button>
          @if (editor().simulates) {
            <button
              *appIfRole="simulateRole"
              type="button"
              class="btn btn-secondary cancel-button"
              [disabled]="!editor().canSimulate()"
              [attr.aria-busy]="editor().simulation.loading()"
              (click)="editor().simulate()"
            >
              {{ editor().simulation.loading() ? 'Simulando…' : 'Simular' }}
            </button>
          }
          <button
            type="button"
            class="btn btn-primary save-button"
            [disabled]="!editor().canSave()"
            (click)="editor().openConfirm()"
          >
            Guardar cambios
          </button>
        </ng-container>
      }
    </div>
    @if (needsSimulation()) {
      <p class="save-hint">
        Simula los cambios antes de guardar: el botón se activa con la simulación.
      </p>
    }
    @if (editor().confirming()) {
      <app-confirm-changes-dialog
        [title]="title()"
        [changes]="editor().changeRows()"
        [saving]="editor().saving()"
        [error]="editor().saveError()"
        (confirmed)="editor().confirm()"
        (cancelled)="editor().cancelConfirm()"
        (reloadRequested)="editor().reloadAfterConflict()"
      />
    }
  `,
  styles: `
    .save-row {
      flex-wrap: wrap;
    }
    .save-hint {
      margin: 6px 0 0;
      color: var(--text-muted);
      font-size: calc(12px + var(--font-size-increase, 0px));
      text-align: right;
    }
  `,
})
export class ConfigSaveBar {
  readonly editor = input.required<ConfigEditor>();
  readonly title = input('Confirmar cambios');

  readonly simulateRole = ACTION_ROLES.simulateFormula;
  readonly needsSimulation = computed(() => {
    const editor = this.editor();
    return (
      editor.simulates &&
      editor.changeCount() > 0 &&
      editor.valid() &&
      !editor.simulationFresh() &&
      !editor.simulation.loading()
    );
  });
}
