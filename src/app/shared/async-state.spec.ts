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
    [compact]="compact()"
    [variant]="variant()"
    [lines]="lines()"
    emptyText="Sin vulnerabilidades."
    (retry)="retries = retries + 1"
  />`,
})
class Host {
  readonly state = signal<ViewState>('loading');
  readonly compact = signal(false);
  readonly variant = signal<'panel' | 'page'>('panel');
  readonly lines = signal(3);
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

describe('AsyncStateComponent states (F19.4)', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    const element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const host = element.querySelector('app-async-state') as HTMLElement;
    return { fixture, element, host, settle: () => fixture.whenStable() };
  }

  it('loads as a skeleton named only for screen readers, of the height asked for', async () => {
    const { fixture, host, settle } = await render();
    expect(host.getAttribute('data-state')).toBe('loading');
    const status = host.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe('Cargando…');
    expect(status.classList).toContain('sr-only');
    expect(host.querySelector('.skeleton')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('.skeleton-line')).toHaveLength(3);
    fixture.componentInstance.lines.set(40);
    await settle();
    expect(host.querySelectorAll('.skeleton-line')).toHaveLength(12);
    fixture.componentInstance.lines.set(0);
    await settle();
    expect(host.querySelectorAll('.skeleton-line')).toHaveLength(1);
  });

  it('shows the same empty state everywhere, with its state on the host', async () => {
    const { fixture, host, settle } = await render();
    fixture.componentInstance.state.set('empty');
    await settle();
    expect(host.getAttribute('data-state')).toBe('empty');
    expect(host.querySelector('.state-empty svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('.state')?.textContent?.trim()).toBe('Sin vulnerabilidades.');
  });

  it('says only «No disponible» when compact, and retries everything from the page notice', async () => {
    const { fixture, host, settle } = await render();
    fixture.componentInstance.state.set('error');
    fixture.componentInstance.compact.set(true);
    await settle();
    expect(host.querySelector('[role="alert"]')?.textContent?.trim()).toBe('No disponible.');
    expect(host.querySelector('button')).toBeNull();

    fixture.componentInstance.compact.set(false);
    fixture.componentInstance.variant.set('page');
    await settle();
    expect(host.classList).toContain('page-notice');
    const button = host.querySelector('button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Reintentar todo');
    expect(button.classList).toContain('btn-secondary');
    button.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });
});
