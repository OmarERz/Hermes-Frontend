import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../core/api/api-error';
import { AsyncState } from './async-state';
import { AsyncStateComponent, ViewState } from './async-state.component';

describe('AsyncState', () => {
  it('goes from loading to ready with the value', () => {
    const state = new AsyncState<number>();
    const source = new Subject<number>();
    state.run(source);
    expect(state.status()).toBe('loading');
    expect(state.loading()).toBe(true);
    source.next(7);
    expect(state.status()).toBe('ready');
    expect(state.value()).toBe(7);
  });

  it('keeps an ApiError when the load fails', () => {
    const state = new AsyncState<number>();
    state.run(throwError(() => new ApiError(503, 'auth_unavailable', 'No responde.')));
    expect(state.status()).toBe('error');
    expect(state.error()?.code).toBe('auth_unavailable');
  });

  it('ignores a slow older load once a newer one starts', () => {
    const state = new AsyncState<string>();
    const old = new Subject<string>();
    state.run(old);
    state.run(of('new'));
    old.next('old');
    expect(state.value()).toBe('new');
  });
});

@Component({
  imports: [AsyncStateComponent],
  template: `<app-async-state
    [state]="state()"
    [error]="error"
    emptyText="Sin vulnerabilidades."
    (retry)="retries = retries + 1"
  />`,
})
class Host {
  readonly state = signal<ViewState>('loading');
  readonly error = new ApiError(0, 'network_error', 'No se pudo conectar con el servidor.');
  retries = 0;
}

describe('AsyncStateComponent', () => {
  it('shows loading, empty and error states and offers a retry', async () => {
    const fixture = TestBed.createComponent(Host);
    const element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Cargando');

    fixture.componentInstance.state.set('empty');
    await fixture.whenStable();
    expect(element.textContent).toContain('Sin vulnerabilidades.');

    fixture.componentInstance.state.set('error');
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo conectar con el servidor.',
    );
    element.querySelector('button')?.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });
});
