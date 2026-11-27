import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { CurrentUser } from '../../core/api/api-types';
import { SessionService } from '../../core/auth/session.service';
import { provideFakeSession } from '../../testing/fake-session';
import { formatDateTime } from '../../shared/labels';
import { isEmail, userName, UsersPage } from './users.page';
import { RoleAssigned, UserAccount, UserCreated, UsersService } from './users.service';

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

/** Created from the app (D-105): a stored role, never signed in yet. */
const INVITED: UserAccount = {
  uid: 'invited-uid',
  email: 'zoe@hermes.test',
  display_name: null,
  role: 'analyst',
  claim_role: 'analyst',
  effective_role: 'analyst',
  active: true,
  signed_in: false,
  last_login_at: null,
};

const CREATED: UserCreated = {
  uid: 'created-uid',
  email: 'nueva@hermes.test',
  role: 'analyst',
  password_email_sent: true,
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
  create = vi.fn<UsersService['create']>(() => of(CREATED));
  sendPasswordEmail = vi.fn<UsersService['sendPasswordEmail']>((uid) =>
    of({ uid, email: 'zoe@hermes.test' }),
  );
  setStatus = vi.fn<UsersService['setStatus']>((uid, disabled) =>
    of({ uid, disabled, sessions_revoked: disabled, known_user: true }),
  );
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
    expect(newcomer.querySelectorAll('app-chip')[0].getAttribute('data-tone')).toBe('danger');
    expect(admin.querySelector('app-chip')?.getAttribute('data-tone')).toBe('accent');
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

  // --- accounts from the app (D-105) -----------------------------------------------------------------------------

  function dialog(element: HTMLElement): HTMLElement | null {
    return element.querySelector('[role="dialog"]');
  }

  function button(root: Element | null, label: string): HTMLButtonElement | undefined {
    return Array.from(root?.querySelectorAll('button') ?? []).find((b) => text(b) === label) as
      HTMLButtonElement | undefined;
  }

  async function openCreate(element: HTMLElement, settle: () => Promise<void>) {
    button(element.querySelector('.inventory > header'), 'Agregar usuario')!.click();
    await settle();
    const form = dialog(element)!;
    const email = form.querySelector('input[type="email"]') as HTMLInputElement;
    const role = form.querySelector('select') as HTMLSelectElement;
    const type = async (value: string) => {
      email.value = value;
      email.dispatchEvent(new Event('input'));
      await settle();
    };
    return { form, email, role, type };
  }

  it('accepts only e-mails the backend accepts', () => {
    expect(isEmail('eva@hermes.test')).toBe(true);
    expect(isEmail("o'neil+hermes@sub.example.co")).toBe(true);
    for (const bad of ['', 'eva', 'eva@', '@hermes.test', 'eva@hermes', 'e va@hermes.test']) {
      expect(isEmail(bad)).toBe(false);
    }
    expect(isEmail(`${'a'.repeat(65)}@hermes.test`)).toBe(false);
    expect(isEmail(`a@${'b'.repeat(250)}.com`)).toBe(false);
  });

  it('creates an account from the dialog and names the address that got the e-mail', async () => {
    const { element, settle, users } = await render();
    const { form, email, role, type } = await openCreate(element, settle);
    expect(text(form.querySelector('h2'))).toBe('Agregar usuario');
    expect(text(form)).toContain('Hermes nunca la ve ni la guarda.');
    expect(role.value).toBe('reader');
    const submit = button(form, 'Crear usuario')!;
    expect(submit.disabled).toBe(true);

    await type('no-es-correo');
    email.dispatchEvent(new Event('blur'));
    await settle();
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(text(form)).toContain('Escribe un correo válido');
    expect(submit.disabled).toBe(true);

    await type('  Nueva@hermes.test ');
    role.value = 'analyst';
    role.dispatchEvent(new Event('change'));
    await settle();
    expect(email.getAttribute('aria-invalid')).toBe('false');
    const listed = users.list.mock.calls.length;
    submit.click();
    await settle();
    expect(users.create).toHaveBeenCalledWith('Nueva@hermes.test', 'analyst');
    expect(dialog(element)).toBeNull();
    expect(text(element.querySelector('.admin-notice[role="status"]'))).toBe(
      'Se envió un correo a nueva@hermes.test para crear su contraseña.',
    );
    expect(users.list.mock.calls.length).toBe(listed + 1);
  });

  it('says when the account exists but the e-mail did not go out', async () => {
    const users = new FakeUsers();
    users.create.mockReturnValue(of({ ...CREATED, password_email_sent: false }));
    const { element, settle } = await render(users);
    const { form, type } = await openCreate(element, settle);
    await type('nueva@hermes.test');
    button(form, 'Crear usuario')!.click();
    await settle();
    expect(text(element.querySelector('.admin-notice[role="alert"]'))).toBe(
      'Se creó la cuenta de nueva@hermes.test, pero no se pudo enviar el correo. Usa «Reenviar correo» en su fila.',
    );
  });

  it('keeps the dialog open with the reason of a refusal, and closes it on demand', async () => {
    const users = new FakeUsers();
    users.create.mockReturnValue(
      throwError(() => new ApiError(409, 'email_exists', 'Ya existe una cuenta con ese correo.')),
    );
    const { element, settle, page } = await render(users);
    const { form, type } = await openCreate(element, settle);
    await type('eva@hermes.test');
    button(form, 'Crear usuario')!.click();
    await settle();
    expect(text(dialog(element)?.querySelector('[role="alert"]'))).toBe(
      'Ya existe una cuenta con ese correo.',
    );
    button(dialog(element), 'Cancelar')!.click();
    await settle();
    expect(dialog(element)).toBeNull();
    expect(page.createError()).toBeNull();
  });

  it('does not create twice nor close while creating', async () => {
    const users = new FakeUsers();
    const pending = new Subject<UserCreated>();
    users.create.mockReturnValue(pending.asObservable());
    const { page } = await render(users);
    page.openCreate();
    page.newUser.set({ email: 'eva@hermes.test', role: 'reader' });
    page.create();
    page.create();
    page.closeCreate();
    expect(users.create).toHaveBeenCalledTimes(1);
    expect(page.newUser()).not.toBeNull();
    pending.next(CREATED);
    expect(page.newUser()).toBeNull();
    page.create(); // nothing to create once the dialog is closed
    page.setNewEmail({ target: { value: 'x@y.zz' } } as unknown as Event);
    page.setNewRole({ target: { value: 'admin' } } as unknown as Event);
    expect(page.newUser()).toBeNull();
    expect(users.create).toHaveBeenCalledTimes(1);
  });

  it('ignores a role that is not one of the three', async () => {
    const { page } = await render();
    page.openCreate();
    page.setNewRole({ target: { value: 'superuser' } } as unknown as Event);
    expect(page.newUser()?.role).toBe('reader');
  });

  it('switches another account off after a confirmation, never the own one', async () => {
    const { element, settle, users } = await render();
    const [own, reader, newcomer] = rows(element);
    expect(text(own)).toContain('Es tu cuenta.');
    expect(button(own, 'Desactivar')).toBeUndefined();
    expect(button(newcomer, 'Reactivar')).toBeDefined();

    button(reader, 'Desactivar')!.click();
    await settle();
    const confirm = dialog(element)!;
    expect(text(confirm.querySelector('h2'))).toBe('Desactivar cuenta');
    expect(text(confirm)).toContain('Cuenta de luis@hermes.test');
    expect(text(confirm)).toContain('Anterior Activa');
    expect(text(confirm)).toContain('Nuevo Desactivada');
    expect(users.setStatus).not.toHaveBeenCalled();
    const listed = users.list.mock.calls.length;
    (confirm.querySelector('.save-button') as HTMLButtonElement).click();
    await settle();
    expect(users.setStatus).toHaveBeenCalledWith(READER.uid, true);
    expect(dialog(element)).toBeNull();
    expect(text(element.querySelector('.admin-notice[role="status"]'))).toBe(
      'La cuenta de luis@hermes.test quedó desactivada y se cerraron sus sesiones.',
    );
    expect(users.list.mock.calls.length).toBe(listed + 1);
  });

  it('switches an account back on', async () => {
    const { element, settle, users } = await render();
    button(rows(element)[2], 'Reactivar')!.click();
    await settle();
    expect(text(dialog(element)?.querySelector('h2'))).toBe('Reactivar cuenta');
    expect(text(dialog(element))).toContain('sus sesiones de antes siguen cerradas');
    (dialog(element)!.querySelector('.save-button') as HTMLButtonElement).click();
    await settle();
    expect(users.setStatus).toHaveBeenCalledWith(NEWCOMER.uid, false);
    expect(text(element.querySelector('.admin-notice'))).toBe(
      'La cuenta de Eva está activa de nuevo: tendrá que iniciar sesión.',
    );
  });

  it('explains a switch-off whose sessions could not be closed', async () => {
    const users = new FakeUsers();
    users.setStatus.mockReturnValue(
      of({ uid: READER.uid, disabled: true, sessions_revoked: false, known_user: true }),
    );
    const { page, element, settle } = await render(users);
    page.askStatus({ ...page.rows()[1] });
    page.confirmStatus();
    await settle();
    expect(text(element.querySelector('.admin-notice'))).toContain('Firebase ya rechaza su acceso');
  });

  it('keeps the confirmation open on a failure and reads the list again when it is stale', async () => {
    const users = new FakeUsers();
    users.setStatus.mockReturnValueOnce(
      throwError(() => new ApiError(503, 'auth_unavailable', 'No se pudo cambiar el estado.')),
    );
    users.setStatus.mockReturnValueOnce(
      throwError(() => new ApiError(404, 'user_not_found', 'El usuario no existe en Firebase.')),
    );
    const { element, settle, page } = await render(users);
    button(rows(element)[1], 'Desactivar')!.click();
    await settle();
    (dialog(element)!.querySelector('.save-button') as HTMLButtonElement).click();
    await settle();
    expect(text(dialog(element)?.querySelector('[role="alert"]'))).toBe(
      'No se pudo cambiar el estado.',
    );
    const listed = users.list.mock.calls.length;
    (dialog(element)!.querySelector('.save-button') as HTMLButtonElement).click();
    await settle();
    expect(dialog(element)).toBeNull();
    expect(text(element.querySelector('.admin-notice[role="alert"]'))).toBe(
      'El usuario no existe en Firebase.',
    );
    expect(users.list.mock.calls.length).toBe(listed + 1);
    page.askStatus(page.rows()[0]); // the own row: never
    page.confirmStatus(); // nothing waiting
    expect(page.statusChange()).toBeNull();
    expect(users.setStatus).toHaveBeenCalledTimes(2);
  });

  it('does not change the status twice nor close while saving', async () => {
    const users = new FakeUsers();
    const pending = new Subject<{
      uid: string;
      disabled: boolean;
      sessions_revoked: boolean;
      known_user: boolean;
    }>();
    users.setStatus.mockReturnValue(pending.asObservable());
    const { page } = await render(users);
    page.askStatus(page.rows()[1]);
    page.confirmStatus();
    page.confirmStatus();
    page.cancelStatus();
    expect(users.setStatus).toHaveBeenCalledTimes(1);
    expect(page.statusChange()).not.toBeNull();
    pending.next({ uid: READER.uid, disabled: true, sessions_revoked: true, known_user: true });
    pending.complete();
    expect(page.statusChange()).toBeNull();
    page.askStatus(page.rows()[1]);
    page.cancelStatus();
    expect(page.statusChange()).toBeNull();
  });

  it('sends the password e-mail again to an account that never signed in', async () => {
    const users = new FakeUsers();
    users.list.mockReturnValue(of({ items: [ADMIN, READER, INVITED], nextCursor: null }));
    const { element, settle } = await render(users);
    const [, reader, invited] = rows(element);
    expect(cells(invited)[2]).toBe('Analista'); // the role stored when it was created
    expect(button(reader, 'Reenviar correo')).toBeUndefined();
    button(invited, 'Reenviar correo')!.click();
    await settle();
    expect(users.sendPasswordEmail).toHaveBeenCalledWith(INVITED.uid);
    expect(text(element.querySelector('.admin-notice[role="status"]'))).toBe(
      'Se envió un correo a zoe@hermes.test para crear su contraseña.',
    );
  });

  it('says why the password e-mail could not be sent, and sends one at a time', async () => {
    const users = new FakeUsers();
    users.list.mockReturnValue(of({ items: [ADMIN, INVITED], nextCursor: null }));
    users.sendPasswordEmail.mockReturnValueOnce(
      throwError(() => new ApiError(429, 'too_many_emails', 'Se enviaron demasiados correos.')),
    );
    const { element, settle, page } = await render(users);
    button(rows(element)[1], 'Reenviar correo')!.click();
    await settle();
    expect(text(element.querySelector('.admin-notice[role="alert"]'))).toBe(
      'Se enviaron demasiados correos.',
    );
    const pending = new Subject<{ uid: string; email: string }>();
    users.sendPasswordEmail.mockReturnValue(pending.asObservable());
    page.resend(page.rows()[1]);
    page.resend(page.rows()[1]);
    page.resend(page.rows()[0]); // an account that signed in is not offered the e-mail
    expect(users.sendPasswordEmail).toHaveBeenCalledTimes(2);
    pending.next({ uid: INVITED.uid, email: 'zoe@hermes.test' });
    pending.complete();
    expect(page.resending()).toBeNull();
  });
});
