import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import type { CursorPage } from '../../shared/cursor-pager';
import { provideFakeSession } from '../../testing/fake-session';
import { ConfigApi } from './config-api';
import type { ConfigVersion } from './config-model';
import { ConfigStore } from './config-store';
import { ConfigVersions } from './config-versions';
import { configDocument, SCHEMA } from './testing/config-fixtures';

const VERSIONS: ConfigVersion[] = [
  { version: 7, created_at: '2026-11-22T15:00:00Z', author: 'Ana', summary: 'Cambió: dead_zone' },
  {
    version: 6,
    created_at: '2026-11-21T10:00:00Z',
    author: 'Luis',
    summary: 'Cambió: weights.P, weights.S',
  },
];

class FakeConfigApi {
  schema = vi.fn<ConfigApi['schema']>(() => of(SCHEMA));
  config = vi.fn<ConfigApi['config']>(() => of(configDocument()));
  versions = vi.fn<ConfigApi['versions']>(() => of({ items: VERSIONS, nextCursor: 'n.sig' }));
  restore = vi.fn<ConfigApi['restore']>(() => of(configDocument(8)));
}

@Component({
  imports: [ConfigVersions],
  providers: [ConfigStore],
  template: `<app-config-versions (restored)="restored = $event" />`,
})
class Host {
  readonly store = inject(ConfigStore);
  restored: number | null = null;

  constructor() {
    this.store.load();
  }
}

async function render(role: Role, api = new FakeConfigApi()) {
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [{ provide: ConfigApi, useValue: api }, ...provideFakeSession(role)],
  });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as
      HTMLButtonElement | undefined;
  return { fixture, element, api, button };
}

describe('ConfigVersions', () => {
  it('lists the versions with who and when and marks the current one', async () => {
    const { element, api } = await render('admin');
    const rows = Array.from(element.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('v7');
    expect(rows[0].textContent).toContain('Vigente');
    expect(rows[0].querySelector('button')).toBeNull();
    expect(rows[1].textContent).toContain('Luis');
    expect(rows[1].querySelector('button')?.getAttribute('aria-label')).toBe(
      'Restaurar la versión 6',
    );
    expect(api.versions).toHaveBeenCalledWith(null, 10);
  });

  it('hides restore from anyone but an admin', async () => {
    const { element } = await render('analyst');
    expect(element.querySelectorAll('tbody tr').length).toBe(2);
    expect(element.querySelector('tbody button')).toBeNull();
  });

  it('pages with the cursor of the response', async () => {
    const { fixture, element, api } = await render('reader');
    (element.querySelector('[aria-label="Página siguiente"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(api.versions).toHaveBeenLastCalledWith('n.sig', 10);
    (element.querySelector('[aria-label="Página anterior"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(api.versions).toHaveBeenLastCalledWith(null, 10);
  });

  it('restores a version with the version read and reads the history again', async () => {
    const { fixture, element, api, button } = await render('admin');
    (element.querySelector('[aria-label="Restaurar la versión 6"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    const dialog = element.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Restaurar la versión 6');
    expect(dialog.textContent).toContain('Una versión nueva con los valores de la versión 6');

    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(api.restore).toHaveBeenCalledWith(6, 7);
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(element.textContent).toContain('Se restauró la versión 6 como la versión 8.');
    expect(fixture.componentInstance.restored).toBe(8);
    expect(fixture.componentInstance.store.version()).toBe(8);
    expect(api.versions).toHaveBeenCalledTimes(2);
  });

  it('says so when the restored version had the current values', async () => {
    const api = new FakeConfigApi();
    api.restore.mockReturnValue(of(configDocument(7)));
    const { fixture, element, button } = await render('admin', api);
    (element.querySelector('[aria-label="Restaurar la versión 6"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(element.textContent).toContain(
      'La versión 6 tiene los mismos valores que la vigente: no se creó una versión nueva.',
    );
    expect(fixture.componentInstance.restored).toBeNull();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });

  it('cancels a restore without calling the API', async () => {
    const { fixture, element, api, button } = await render('admin');
    (element.querySelector('[aria-label="Restaurar la versión 6"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    button('Cancelar')?.click();
    await fixture.whenStable();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(api.restore).not.toHaveBeenCalled();
  });

  it('offers to reload when someone saved in between', async () => {
    const api = new FakeConfigApi();
    api.restore.mockReturnValue(
      throwError(() => new ApiError(409, 'version_conflict', 'La configuración cambió.')),
    );
    const { fixture, element, button } = await render('admin', api);
    (element.querySelector('[aria-label="Restaurar la versión 6"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(element.querySelector('.dialog-error')?.textContent).toContain('Alguien guardó cambios');

    api.config.mockReturnValue(of(configDocument(9)));
    button('Recargar')?.click();
    await fixture.whenStable();
    expect(api.config).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(element.querySelector('tbody tr')?.textContent).not.toContain('Vigente');
  });

  it('keeps the dialog open with the API message on another failure', async () => {
    const api = new FakeConfigApi();
    api.restore.mockReturnValue(
      throwError(() => new ApiError(404, 'not_found', 'La versión solicitada no existe.')),
    );
    const { fixture, element, button } = await render('admin', api);
    (element.querySelector('[aria-label="Restaurar la versión 6"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    button('Confirmar cambios')?.click();
    await fixture.whenStable();
    expect(element.querySelector('.dialog-error')?.textContent).toContain(
      'La versión solicitada no existe.',
    );
  });

  it('shows the loading, empty and error states', async () => {
    const api = new FakeConfigApi();
    const pending = new Subject<CursorPage<ConfigVersion>>();
    api.versions.mockReturnValueOnce(pending);
    const { fixture, element } = await render('reader', api);
    expect(element.textContent).toContain('Cargando versiones…');
    pending.next({ items: [], nextCursor: null });
    await fixture.whenStable();
    expect(element.textContent).toContain('Todavía no hay versiones.');

    api.versions.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Ocurrió un error en el servidor.')),
    );
    api.config.mockReturnValue(of(configDocument(10)));
    fixture.componentInstance.store.load();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Ocurrió un error en el servidor.',
    );
  });
});
