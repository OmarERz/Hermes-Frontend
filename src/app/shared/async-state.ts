import { computed, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ApiError, toApiError } from '../core/api/api-error';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * State of one async load, as signals (the app is zoneless: plain fields set inside `subscribe` do not
 * re-render). `run` cancels the previous load, so a slow old response never overwrites a newer one.
 */
export class AsyncState<T> {
  readonly status = signal<LoadStatus>('idle');
  readonly value = signal<T | null>(null);
  readonly error = signal<ApiError | null>(null);
  readonly loading = computed(() => this.status() === 'loading');

  private subscription: Subscription | null = null;

  run(source: Observable<T>): void {
    this.subscription?.unsubscribe();
    this.status.set('loading');
    this.error.set(null);
    this.subscription = source.subscribe({
      next: (value) => {
        this.value.set(value);
        this.status.set('ready');
      },
      error: (error: unknown) => {
        this.error.set(toApiError(error));
        this.status.set('error');
      },
    });
  }

  /** Stops the load in flight (call it from the component's DestroyRef). */
  cancel(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }
}
