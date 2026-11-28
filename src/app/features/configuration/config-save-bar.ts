import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { ACTION_ROLES } from '../../core/auth/roles';
import { ConfirmChangesDialog } from '../../shared/confirm-changes-dialog';
import type { ConfigEditor } from './config-editor';

/**
 * The prototype's save row for a ConfigEditor: the result of the last action, "Descartar", "Simular" (admin, when
 * the screen simulates) and "Guardar cambios", which opens the shared before/after confirmation. The actions show
 * only for the role that can save a parameter of the screen; a 409 in the dialog offers to reload. With unsaved
 * changes it sticks to the bottom of the window (above the bottom bar on phones), so saving never needs a scroll
 * back to the middle of a long screen (FOR-3); it is the last block of each screen, so it stays there down to the
 * end. Since «Simular» can be pressed from it, it also says how the simulation went, with a way to its result.
 */
@Component({
  selector: 'app-config-save-bar',
  imports: [ConfirmChangesDialog, IfRoleDirective],
  host: { '[class.is-dirty]': 'editor().changeCount() > 0' },
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
    @if (simulationNote(); as note) {
      <p class="save-simulation" [class.is-error]="note.error" role="status">
        <span>{{ note.text }}</span>
        @if (note.link) {
          <button type="button" class="btn btn-ghost btn-sm" (click)="showSimulation()">
            Ver la simulación
          </button>
        }
      </p>
    }
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
    :host {
      display: block;
    }
    :host(.is-dirty) {
      position: sticky;
      z-index: var(--z-float);
      bottom: var(--space-3);
      margin-top: var(--space-4);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: var(--shadow-2);
    }
    :host(.is-dirty) .save-row {
      flex-direction: row;
      align-items: center;
      margin-top: 0;
    }
    .save-row {
      flex-wrap: wrap;
    }
    @media (max-width: 560px) {
      :host(.is-dirty) {
        bottom: calc(var(--mobile-nav-h) + var(--space-2));
      }
      :host(.is-dirty) .save-row p {
        flex-basis: 100%;
      }
    }
    .save-simulation {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-1) var(--space-3);
      margin: var(--space-2) 0 0;
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
    .save-simulation.is-error {
      color: var(--danger-text);
    }
    .save-hint {
      margin: var(--space-2) 0 0;
      color: var(--text-muted);
      font-size: var(--text-sm);
      text-align: right;
    }
  `,
})
export class ConfigSaveBar {
  private readonly document = inject(DOCUMENT);
  readonly editor = input.required<ConfigEditor>();
  readonly title = input('Confirmar cambios');

  readonly simulateRole = ACTION_ROLES.simulateFormula;
  /** How the last simulation of the draft went, while there are changes (null when there is nothing to say). */
  readonly simulationNote = computed(() => {
    const editor = this.editor();
    if (!editor.simulates || editor.changeCount() === 0) return null;
    const simulation = editor.simulation;
    switch (simulation.status()) {
      case 'loading':
        return { text: 'Simulando…', error: false, link: false };
      case 'error':
        return {
          text: `No se pudo simular: ${simulation.error()?.message ?? 'error desconocido.'}`,
          error: true,
          link: true,
        };
      case 'ready': {
        // A draft changed after simulating: the hint below already asks to simulate again.
        if (editor.simulationStale()) return null;
        const changed = simulation.value()?.result?.changed_findings;
        const text =
          changed === undefined
            ? 'Simulación lista.'
            : `Simulación lista: ${changed} ${changed === 1 ? 'hallazgo cambiaría' : 'hallazgos cambiarían'} de nivel.`;
        return { text, error: false, link: true };
      }
      default:
        return null;
    }
  });

  /** Scrolls to the simulation panel of the screen and puts the focus on its title. */
  showSimulation(): void {
    const title = this.document.getElementById('simulation-title');
    if (!title) return;
    const reduced = this.document.defaultView?.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const section = title.closest('section') ?? title;
    if (typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    }
    title.focus({ preventScroll: true });
  }

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
