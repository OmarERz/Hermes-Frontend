import { Component, input, output } from '@angular/core';
import { ApiError } from '../core/api/api-error';

/** What a list or panel shows instead of its content. */
export type ViewState = 'loading' | 'empty' | 'error';

/**
 * Shared loading, empty and error states, with the look of the prototype's empty rows. The error text is the
 * Spanish message of the API (or of the network fallback), shown as text, with a retry button.
 */
@Component({
  selector: 'app-async-state',
  template: `
    @switch (state()) {
      @case ('loading') {
        <p class="state" role="status" aria-live="polite">{{ loadingText() }}</p>
      }
      @case ('empty') {
        <p class="state">{{ emptyText() }}</p>
      }
      @case ('error') {
        <div class="state state-error" role="alert">
          <p>{{ error()?.message ?? 'Ocurrió un error inesperado.' }}</p>
          @if (retryable()) {
            <button type="button" (click)="retry.emit()">Reintentar</button>
          }
        </div>
      }
    }
  `,
  styles: `
    .state {
      margin: 0;
      padding: 30px;
      color: var(--text-muted, #6b6175);
      text-align: center;
    }
    .state-error {
      display: grid;
      justify-items: center;
      gap: 10px;
      color: var(--danger-text, #b91c1c);
    }
    .state-error p {
      margin: 0;
    }
    button {
      min-height: 36px;
      padding: 6px 14px;
      border: 1px solid var(--border, #e4e3ee);
      border-radius: 8px;
      background: var(--surface-raised, #fff);
      color: var(--text-primary, #321044);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid var(--accent, #ff009d);
      outline-offset: 3px;
    }
  `,
})
export class AsyncStateComponent {
  readonly state = input.required<ViewState>();
  readonly loadingText = input('Cargando…');
  readonly emptyText = input('No hay datos para mostrar.');
  readonly error = input<ApiError | null>(null);
  readonly retryable = input(true);
  readonly retry = output<void>();
}
