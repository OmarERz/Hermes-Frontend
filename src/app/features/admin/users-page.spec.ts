import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { CurrentUser } from '../../core/api/api-types';
import { SessionService } from '../../core/auth/session.service';
import { provideFakeSession } from '../../testing/fake-session';
import { formatDateTime } from '../../shared/labels';
import { userName, UsersPage } from './users.page';
import { RoleAssigned, UserAccount, UsersService } from './users.service';

const ADMIN: UserAccount = {
  uid: 'admin-uid',
  email: 'ana@hermes.test',
  display_name: 'Ana Admin',
  role: 'admin',
  claim_role: 'admin',
  effective_role: 'admin',
  active: true,
  signed_in: true,
  last_login_at: '2026-11-27T08:00:00Z',
};

const READER: UserAccount = {
  uid: 'reader-uid',
  email: 'luis@hermes.test',
  display_name: null,
  role: 'reader',
  claim_role: 'analyst',
  effective_role: 'reader',
  active: true,
  signed_in: true,
  last_login_at: null,
};

const NEWCOMER: UserAccount = {
  uid: 'new-uid',
  email: 'eva@hermes.test',
  display_name: 'Eva',
  role: null,
  claim_role: null,
  effective_role: null,
  active: false,
  signed_in: false,
  last_login_at: null,
};

const ASSIGNED: RoleAssigned = {
  uid: READER.uid,
  role: 'analyst',
  sessions_revoked: true,
  known_user: true,
};

class FakeUsers {
  list = vi.fn<UsersService['list']>(() =>
    of({ items: [ADMIN, READER, NEWCOMER], nextCursor: 'n.s' }),
  );
  assignRole = vi.fn<UsersService['assignRole']>(() => of(ASSIGNED));
}

async function render(users = new FakeUsers()) {
  TestBed.configureTestingModule({
    imports: [UsersPage],
    providers: [
      { provide: UsersService, useValue: users },
      ...provideFakeSession('admin'),
      provideRouter([]),
    ],
  });
  const session = TestBed.inject(SessionService);
  session.profile.set({
    uid: ADMIN.uid,
    email: ADMIN.email!,
    display_name: 'Ana',
    role: 'admin',
  } as CurrentUser);
  const fixture = TestBed.createComponent(UsersPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, page: fixture.componentInstance, element, users, settle };
}

/** The visible text, one space between the texts of separate elements (the template has no whitespace there). */
function text(element: Element | null | undefined): string {
  if (!element) return '';
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function rows(element: HTMLElement): HTMLTableRowElement[] {
  return Array.from(element.querySelectorAll('.users-table tbody tr'));
}

function cells(row: Element): string[] {
  return Array.from(row.querySelectorAll('td')).map((cell) => text(cell));
}

function choose(row: Element, value: string): HTMLSelectElement {
  const select = row.querySelector('select') as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change'));
  return select;
}

describe('UsersPage', () => {
  it('names a person by display name, then e-mail, then uid', () => {
    expect(userName(ADMIN)).toBe('Ana Admin');
    expect(userName(READER)).toBe('luis@hermes.test');
    expect(userName({ ...NEWCOMER, display_name: ' ', email: null })).toBe('new-uid');
  });

  it('shows each account with its effective, stored and claim roles', async () => {
    const { element } = await render();
    const [admin, reader, newcomer] = rows(element);
    expect(cells(admin).slice(0, 6)).toEqual([
      'Ana Admin Tú ana@hermes.test',
      'Administrador',
      'Administrador',
      'Administrador',
      'Activa',
      formatDateTime(ADMIN.last_login_at!),
    ]);
    expect(cells(reader).slice(0, 6)).toEqual([
      'luis@hermes.test',
      'Lector',
      'Lector',
      'Analista',
      'Activa',
      'Nunca',
    ]);
    expect(cells(newcomer).slice(0, 5)).toEqual([
      'Eva eva@hermes.test',
      'Sin acceso',
      'Nunca inició sesión',
      'Sin claim',
      'Desactivada',
    ]);
    expect(newcomer.querySelectorAll('.chip')[0].classList).toContain('bad');
  });

  it('never offers to change the own role', async () => {
    const { element } = await render();
    const own = rows(element)[0];
    expect(own.querySelector('select')).toBeNull();
    expect(text(own)).toContain('Tu propio rol no se puede cambiar.');
  });

  it('asks to confirm a role change and keeps the select on the stored role meanwhile', async () => {
    const { element, settle, users } = await render();
    const select = choose(rows(element)[1], 'analyst');
    await settle();
    expect(select.value).toBe('reader');
    const dialog = element.querySelector('[role="dialog"]')!;
    expect(text(dialog.querySelector('h2'))).toBe('Confirmar cambio de rol');
    expect(text(dialog)).toContain('Rol de luis@hermes.test');
    expect(text(dialog)).toContain('Anterior Lector');
    expect(text(dialog)).toContain('Nuevo Analista');
    expect(users.assignRole).not.toHaveBeenCalled();
  });

  it('saves the role with the expected role, says so and reads the list again', async () => {
    const { element, settle, users } = await render();
    choose(rows(element)[1], 'analyst');
    await settle();
    const listed = users.list.mock.calls.length;
    (element.querySelector('.save-button') as HTMLButtonElement).click();
    await settle();
    expect(users.assignRole).toHaveBeenCalledWith(READER.uid, 'analyst', 'reader');
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(text(element.querySelector('.admin-notice[role="status"]'))).toBe(
      'luis@hermes.test ahora tiene el rol Analista. Se cerraron sus sesiones: tendrá que iniciar sesión de nuevo.',
    );
    expect(users.list.mock.calls.length).toBe(listed + 1);
  });

  it('explains when the sessions could not be closed', async () => {
    const users = new FakeUsers();
    users.assignRole.mockReturnValue(of({ ...ASSIGNED, sessions_revoked: false }));
    const { page, element, settle } = await render(users);
    page.change.set({ account: READER, role: 'analyst' });
    page.confirmRole();
    await settle();
    expect(text(element.querySelector('.admin-notice'))).toContain(
      'No se pudieron cerrar sus sesiones',
    );
  });

  it('gives a role to someone who never signed in, with no stored role expected', async () => {
    const users = new FakeUsers();
    users.assignRole.mockReturnValue(
      of({ uid: NEWCOMER.uid, role: 'reader', sessions_revoked: true, known_user: false }),
    );
    const { element, settle } = await render(users);
    const select = rows(element)[2].querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('');
    choose(rows(element)[2], 'reader');
    await settle();
    expect(text(element.querySelector('[role="dialog"]'))).toContain('Anterior Sin rol guardado');
    (element.querySelector('.save-button') as HTMLButtonElement).click();
    await settle();
    expect(users.assignRole).toHaveBeenCalledWith(NEWCOMER.uid, 'reader', null);
    expect(text(element.querySelector('.admin-notice'))).toBe(
      'Eva ahora tiene el rol Lector. Todavía no inicia sesión en Hermes: el rol aplica desde su primer acceso.',
    );
  });

  it('ignores choosing the stored role again', async () => {
    const { element, settle, page } = await render();
    choose(rows(element)[1], 'reader');
    await settle();
    expect(page.change()).toBeNull();
  });

  it('keeps the dialog open with the reason of a refusal', async () => {
    const users = new FakeUsers();
    users.assignRole.mockReturnValue(
      throwError(
        () =>
          new ApiError(
            409,
            'last_admin',
            'No puede quedar el sistema sin un administrador activo.',
          ),
      ),
    );
    const { element, settle } = await render(users);
    choose(rows(element)[1], 'admin');
    await settle();
    (element.querySelector('.save-button') as HTMLButtonElement).click();
    await settle();
    expect(text(element.querySelector('[role="dialog"] [role="alert"]'))).toBe(
      'No puede quedar el sistema sin un administrador activo.',
    );
    (element.querySelector('.cancel-button') as HTMLButtonElement).click();
    await settle();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });

  it('reads the list again when the role changed meanwhile', async () => {
    const users = new FakeUsers();
    users.assignRole.mockReturnValue(
      throwError(
        () =>
          new ApiError(
            409,
            'role_changed',
            'El rol cambió desde que lo leíste (o no se puede comprobar); vuelve a cargarlo.',
          ),
      ),
    );
    const { element, settle } = await render(users);
    choose(rows(element)[1], 'analyst');
    await settle();
    const listed = users.list.mock.calls.length;
    (element.querySelector('.save-button') as HTMLButtonElement).click();
    await settle();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(text(element.querySelector('.admin-notice[role="alert"]'))).toContain(
      'El rol cambió desde que lo leíste',
    );
    expect(users.list.mock.calls.length).toBe(listed + 1);
  });

  it('does not save twice nor close the dialog while saving', async () => {
    const users = new FakeUsers();
    const pending = new Subject<RoleAssigned>();
    users.assignRole.mockReturnValue(pending.asObservable());
    const { page } = await render(users);
    page.change.set({ account: READER, role: 'analyst' });
    page.confirmRole();
    page.confirmRole();
    page.cancelRole();
    expect(users.assignRole).toHaveBeenCalledTimes(1);
    expect(page.change()).not.toBeNull();
    pending.next(ASSIGNED);
    expect(page.change()).toBeNull();
  });

  it('shows why the accounts could not be read, and pages by cursor', async () => {
    const users = new FakeUsers();
    users.list.mockReturnValueOnce(
      throwError(
        () =>
          new ApiError(503, 'auth_unavailable', 'No se pudo contactar al proveedor de identidad.'),
      ),
    );
    const { element, settle } = await render(users);
    expect(text(element.querySelector('[role="alert"]'))).toContain(
      'No se pudo contactar al proveedor de identidad.',
    );
    (element.querySelector('app-async-state button') as HTMLButtonElement).click();
    await settle();
    expect(rows(element)).toHaveLength(3);
    (
      element.querySelector('[aria-label="Página siguiente de cuentas"]') as HTMLButtonElement
    ).click();
    await settle();
    expect(users.list).toHaveBeenLastCalledWith('n.s', 50);
  });

  it('refreshes the list and clears the last notice', async () => {
    const { page, element, settle, users } = await render();
    page.notice.set({ kind: 'ok', text: 'Hecho.' });
    await settle();
    (element.querySelector('.inventory > header button') as HTMLButtonElement).click();
    await settle();
    expect(page.notice()).toBeNull();
    expect(users.list).toHaveBeenCalledTimes(2);
  });

  it('says when there are no accounts', async () => {
    const users = new FakeUsers();
    users.list.mockReturnValue(of({ items: [], nextCursor: null }));
    const { element } = await render(users);
    expect(text(element.querySelector('app-async-state'))).toBe('No hay cuentas en Firebase.');
  });
});
