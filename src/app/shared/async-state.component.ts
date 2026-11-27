import { booleanAttribute, Component, input, numberAttribute, output } from '@angular/core';
import { LucideCircleAlert, LucideInbox } from '@lucide/angular';
import { ApiError } from '../core/api/api-error';

/** What a list or panel shows instead of its content. */
export type ViewState = 'loading' | 'empty' | 'error';

/**
 * Shared loading, empty and error states (F19.4, docs/front/diseno-ronda-1.md G11, AGE-5, VUL-6).
 *   loading  a skeleton of `lines` bars (no animation with reduced motion); the loading text is read by screen readers
 *            only, so the panel keeps its height instead of jumping when the data arrive
 *   empty    one look on every screen: a muted icon and the text
 *   error    the Spanish message of the API (or of the network fallback) as text, with a retry button; `compact` says
 *            only «No disponible», for the panels under a page notice that already gives the message and the retry
 *   page     `variant="page"`: the notice at the top of a page whose reads all failed, with one retry for all of them
 * The host carries the state (`data-state`), so a list's footer hides its pagination while the list is empty
 * (src/styles/states.css).
 */
@Component({
  selector: 'app-async-state',
  imports: [LucideCircleAlert, LucideInbox],
  host: {
    '[attr.data-state]': 'state()',
    '[class.page-notice]': "variant() === 'page'",
  },
  template: `
    @switch (state()) {
      @case ('loading') {
        <div class="state-loading">
          <p class="sr-only" role="status" aria-live="polite">{{ loadingText() }}</p>
          <div class="skeleton" aria-hidden="true">
            @for (line of skeletonLines(); track line) {
              <span class="skeleton-line"></span>
            }
          </div>
        </div>
      }
      @case ('empty') {
        <div class="state-empty">
          <svg lucideInbox aria-hidden="true"></svg>
          <p class="state">{{ emptyText() }}</p>
        </div>
      }
      @case ('error') {
        <div class="state state-error" [class.compact]="compact()" role="alert">
          <svg lucideCircleAlert aria-hidden="true"></svg>
          <p>
            @if (compact()) {
              No disponible.
            } @else {
              {{ error()?.message ?? 'Ocurrió un error inesperado.' }}
            }
          </p>
          @if (retryable() && !compact()) {
            <button type="button" class="btn btn-secondary btn-sm" (click)="retry.emit()">
              {{ variant() === 'page' ? 'Reintentar todo' : 'Reintentar' }}
            </button>
          }
        </div>
      }
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    .state-loading {
      padding: var(--space-4) 0;
    }
    .skeleton {
      display: grid;
      gap: var(--space-3);
    }
    .skeleton-line {
      display: block;
      height: 14px;
      border-radius: var(--radius-xs);
      background: linear-gradient(
        90deg,
        var(--surface-raised) 0%,
        var(--surface-soft) 50%,
        var(--surface-raised) 100%
      );
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.4s ease-in-out infinite;
    }
    .skeleton-line:nth-child(3n + 1) {
      width: 92%;
    }
    .skeleton-line:nth-child(3n + 2) {
      width: 76%;
    }
    .skeleton-line:nth-child(3n) {
      width: 58%;
    }
    .state-empty {
      display: grid;
      justify-items: center;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
      color: var(--text-muted);
      text-align: center;
    }
    .state-empty svg {
      width: 28px;
      height: 28px;
      stroke-width: 1.6;
    }
    .state {
      margin: 0;
      color: var(--text-muted);
      font-size: var(--text-md);
      line-height: var(--leading-normal);
      text-wrap: pretty;
    }
    .state-error {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-2) var(--space-3);
      padding: var(--space-6) var(--space-4);
      color: var(--danger-text);
      text-align: center;
    }
    .state-error svg {
      width: 20px;
      height: 20px;
      flex: none;
    }
    .state-error p {
      margin: 0;
      font-size: var(--text-md);
    }
    .state-error.compact {
      justify-content: flex-start;
      padding: var(--space-3) 0;
      color: var(--text-muted);
    }
    .state-error.compact p {
      font-size: var(--text-sm);
    }
    :host(.page-notice) {
      margin: 0 0 var(--section-gap);
      border: 1px solid color-mix(in srgb, var(--danger-text) 45%, var(--border));
      border-radius: var(--radius-lg);
      background: var(--danger-bg);
    }
    :host(.page-notice) .state-error {
      justify-content: flex-start;
      padding: var(--space-3) var(--space-4);
      text-align: left;
    }
    @keyframes skeleton-shimmer {
      from {
        background-position: 100% 0;
      }
      to {
        background-position: -100% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton-line {
        animation: none;
      }
    }
  `,
})
export class AsyncStateComponent {
  readonly state = input.required<ViewState>();
  readonly loadingText = input('Cargando…');
  readonly emptyText = input('No hay datos para mostrar.');
  readonly error = input<ApiError | null>(null);
  readonly retryable = input(true);
  /** A short «No disponible» instead of the message, under a page notice that already says it. */
  readonly compact = input(false, { transform: booleanAttribute });
  /** 'page': the notice at the top of a page whose reads all failed (one retry for all). */
  readonly variant = input<'panel' | 'page'>('panel');
  /** Bars of the loading skeleton, about the height of what the panel shows (1 to 12). */
  readonly lines = input(3, { transform: numberAttribute });
  readonly retry = output<void>();

  skeletonLines(): number[] {
    const count = Math.max(1, Math.min(12, Math.round(this.lines()) || 1));
    return Array.from({ length: count }, (_, index) => index);
  }
}
