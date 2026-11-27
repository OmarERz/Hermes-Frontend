import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideChevronDown,
  LucideMail,
  LucideRefreshCw,
  LucideUserPlus,
  LucideUsers,
} from '@lucide/angular';
import { finalize } from 'rxjs';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { ApiError, toApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { ACTION_ROLES, ROLE_LABELS } from '../../core/auth/roles';
import { SessionService } from '../../core/auth/session.service';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { Chip, ChipTone } from '../../shared/chip';
import { ConfirmChangesDialog } from '../../shared/confirm-changes-dialog';
import { CursorPager } from '../../shared/cursor-pager';
import { FormDialog } from '../../shared/form-dialog';
import { formatDateTime } from '../../shared/labels';
import type { ChangeRow } from '../../shared/versioned-save';
import {
  RoleAssigned,
  StatusChanged,
  UserAccount,
  UserCreated,
  UsersService,
} from './users.service';

const PAGE_SIZE = 50;
const ROLES: readonly Role[] = ['reader', 'analyst', 'admin'];

/** An account with everything the table shows, already in Spanish. */
export interface UserRow {
  account: UserAccount;
  uid: string;
  name: string;
  email: string | null;
  storedRole: string;
  claimRole: string;
  effectiveRole: string;
  effectiveTone: ChipTone;
  active: boolean;
  lastLogin: string;
  own: boolean;
  /** Invited and not signed in yet (D-105): the password e-mail can be sent again. */
  canResend: boolean;
}

/**
 * A conservative e-mail address, the same rule as the backend's `UserCreation.email` (ASCII local part, a domain with
 * a top-level label): the backend and Firebase check it again.
 */
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
export const EMAIL_MAX_LENGTH = 254;

export function isEmail(value: string): boolean {
  return value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);
}

/** The person's name for messages: the display name, the e-mail or, without both, the uid. */
export function userName(account: UserAccount): string {
  return account.display_name?.trim() || account.email || account.uid;
}

function roleLabel(role: Role | null, missing: string): string {
  return role ? ROLE_LABELS[role] : missing;
}

function toRow(account: UserAccount, ownUid: string | null): UserRow {
  const name = userName(account);
  return {
    account,
    uid: account.uid,
    name,
    email: account.email && account.email !== name ? account.email : null,
    // An account created from the app has a stored role before its first sign-in (D-105).
    storedRole: account.role
      ? ROLE_LABELS[account.role]
      : account.signed_in
        ? 'Sin rol guardado'
        : 'Nunca inició sesión',
    claimRole: roleLabel(account.claim_role, 'Sin claim'),
    effectiveRole: roleLabel(account.effective_role, 'Sin acceso'),
    effectiveTone: !account.effective_role
      ? 'danger'
      : account.effective_role === 'admin'
        ? 'accent'
        : 'success',
    active: account.active,
    lastLogin: account.last_login_at ? formatDateTime(account.last_login_at) : 'Nunca',
    own: ownUid !== null && account.uid === ownUid,
    canResend: !account.signed_in && account.active && Boolean(account.email),
  };
}

/** Codes after which the row the admin read is stale: the dialog closes and the list is read again. */
const STALE_CODES = new Set(['role_changed', 'user_not_found']);

/** The same for a switch-off or switch-on: the account is gone, or it became the own or the last admin's. */
const STATUS_STALE_CODES = new Set(['user_not_found', 'own_status', 'last_admin']);

/**
 * Usuarios y roles (FRONTEND.md §2 and §5, D-030): every Firebase account of `GET /api/admin/users`, signed in or
 * not, with its stored role (the copy in Hermes), the role of its Firebase claim and its effective role (the lower of
 * both: the one its requests get). An admin changes a role with `PUT /api/admin/users/{uid}/role`, sending the stored
 * role as `expected_role`; the backend revokes that person's sessions. Nobody changes their own role (409 `own_role`),
 * so the own row has no control.
 *
 * Accounts from the app (D-105): «Agregar usuario» creates one with an e-mail and a role (`POST /api/admin/users`);
 * Firebase e-mails the person a link to choose a password, which Hermes never sees. «Desactivar» and «Reactivar»
 * (`PUT /api/admin/users/{uid}/status`, after a confirmation) switch another account off or on; «Reenviar correo»
 * (`POST /api/admin/users/{uid}/password-email`) sends the link again to an account that never signed in.
 */
@Component({
  selector: 'app-users-page',
  imports: [
    BannerPagina,
    AsyncStateComponent,
    Chip,
    ConfirmChangesDialog,
    FormDialog,
    IfRoleDirective,
    LucideArrowLeft,
    LucideArrowRight,
    LucideChevronDown,
    LucideMail,
    LucideRefreshCw,
    LucideUserPlus,
    LucideUsers,
  ],
  templateUrl: './users-page.html',
  styleUrls: ['./admin-tables.css', './users-page.css'],
})
export class UsersPage {
  private readonly service = inject(UsersService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly bannerIcon = LucideUsers;
  readonly manageRole = ACTION_ROLES.manageUsers;
  readonly roles = ROLES;
  readonly roleLabels = ROLE_LABELS;

  readonly pager = new CursorPager<UserAccount>((cursor) => this.service.list(cursor, PAGE_SIZE));

  readonly rows = computed(() => {
    const ownUid = this.session.profile()?.uid ?? null;
    return this.pager.items().map((account) => toRow(account, ownUid));
  });

  readonly tableState = computed<ViewState | null>(() => {
    const status = this.pager.state.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.pager.items().length ? null : 'empty';
  });

  /** Role change waiting for the admin's confirmation. */
  readonly change = signal<{ account: UserAccount; role: Role } | null>(null);
  readonly saving = signal(false);
  readonly changeError = signal<ApiError | null>(null);
  readonly changeRows = computed<ChangeRow[]>(() => {
    const requested = this.change();
    if (!requested) return [];
    const { account, role } = requested;
    return [
      {
        name: `Rol de ${userName(account)}`,
        before: roleLabel(account.role, 'Sin rol guardado'),
        after: ROLE_LABELS[role],
        impact:
          'Hermes cierra sus sesiones al guardar: tendrá que iniciar sesión de nuevo para usar el rol nuevo.',
      },
    ];
  });

  readonly notice = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  /** «Agregar usuario»: the dialog is open while `newUser` is set. */
  readonly newUser = signal<{ email: string; role: Role } | null>(null);
  readonly emailTouched = signal(false);
  readonly creating = signal(false);
  readonly createError = signal<ApiError | null>(null);
  readonly emailMaxLength = EMAIL_MAX_LENGTH;
  readonly newEmailValid = computed(() => isEmail(this.newUser()?.email.trim() ?? ''));

  /** Switch-off or switch-on waiting for the admin's confirmation. */
  readonly statusChange = signal<UserAccount | null>(null);
  readonly statusSaving = signal(false);
  readonly statusError = signal<ApiError | null>(null);
  readonly statusTitle = computed(() =>
    this.statusChange()?.active ? 'Desactivar cuenta' : 'Reactivar cuenta',
  );
  readonly statusRows = computed<ChangeRow[]>(() => {
    const account = this.statusChange();
    if (!account) return [];
    return [
      {
        name: `Cuenta de ${userName(account)}`,
        before: account.active ? 'Activa' : 'Desactivada',
        after: account.active ? 'Desactivada' : 'Activa',
        impact: account.active
          ? 'Hermes cierra sus sesiones y no podrá iniciar sesión hasta que la reactives.'
          : 'Podrá iniciar sesión de nuevo; sus sesiones de antes siguen cerradas.',
      },
    ];
  });

  /** The uid whose password e-mail is being sent. */
  readonly resending = signal<string | null>(null);

  constructor() {
    this.pager.first();
    this.destroyRef.onDestroy(() => this.pager.state.cancel());
  }

  refresh(): void {
    this.notice.set(null);
    this.pager.reload();
  }

  /** Asks to confirm a new role; the select goes back to the stored role until the change is saved. */
  askRole(row: UserRow, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const role = select.value as Role;
    select.value = row.account.role ?? '';
    if (row.own || !ROLES.includes(role) || role === row.account.role) return;
    this.changeError.set(null);
    this.change.set({ account: row.account, role });
  }

  confirmRole(): void {
    const requested = this.change();
    if (!requested || this.saving()) return;
    const { account, role } = requested;
    this.saving.set(true);
    this.changeError.set(null);
    this.notice.set(null);
    this.service
      .assignRole(account.uid, role, account.role)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.change.set(null);
          this.notice.set({ kind: 'ok', text: assignedText(account, result) });
          this.pager.reload();
        },
        error: (error: unknown) => {
          const failure = toApiError(error);
          if (!STALE_CODES.has(failure.code)) {
            this.changeError.set(failure);
            return;
          }
          this.change.set(null);
          this.notice.set({ kind: 'error', text: failure.message });
          this.pager.reload();
        },
      });
  }

  cancelRole(): void {
    if (this.saving()) return;
    this.change.set(null);
    this.changeError.set(null);
  }

  openCreate(): void {
    this.createError.set(null);
    this.emailTouched.set(false);
    this.newUser.set({ email: '', role: 'reader' });
  }

  setNewEmail(event: Event): void {
    const email = (event.target as HTMLInputElement).value;
    this.newUser.update((draft) => (draft ? { ...draft, email } : draft));
  }

  setNewRole(event: Event): void {
    const role = (event.target as HTMLSelectElement).value as Role;
    if (!ROLES.includes(role)) return;
    this.newUser.update((draft) => (draft ? { ...draft, role } : draft));
  }

  /** Creates the account; on success the dialog closes and the notice names the address of the e-mail. */
  create(): void {
    const draft = this.newUser();
    if (!draft || this.creating() || !this.newEmailValid()) return;
    this.creating.set(true);
    this.createError.set(null);
    this.notice.set(null);
    this.service
      .create(draft.email.trim(), draft.role)
      .pipe(
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (created) => {
          this.newUser.set(null);
          this.notice.set(createdNotice(created));
          this.pager.reload();
        },
        error: (error: unknown) => this.createError.set(toApiError(error)),
      });
  }

  closeCreate(): void {
    if (this.creating()) return;
    this.newUser.set(null);
    this.createError.set(null);
  }

  askStatus(row: UserRow): void {
    if (row.own) return;
    this.statusError.set(null);
    this.statusChange.set(row.account);
  }

  confirmStatus(): void {
    const account = this.statusChange();
    if (!account || this.statusSaving()) return;
    this.statusSaving.set(true);
    this.statusError.set(null);
    this.notice.set(null);
    this.service
      .setStatus(account.uid, account.active)
      .pipe(
        finalize(() => this.statusSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.statusChange.set(null);
          this.notice.set({ kind: 'ok', text: statusText(account, result) });
          this.pager.reload();
        },
        error: (error: unknown) => {
          const failure = toApiError(error);
          if (!STATUS_STALE_CODES.has(failure.code)) {
            this.statusError.set(failure);
            return;
          }
          this.statusChange.set(null);
          this.notice.set({ kind: 'error', text: failure.message });
          this.pager.reload();
        },
      });
  }

  cancelStatus(): void {
    if (this.statusSaving()) return;
    this.statusChange.set(null);
    this.statusError.set(null);
  }

  /** Sends the password e-mail again to an account that never signed in. */
  resend(row: UserRow): void {
    if (this.resending() || !row.canResend) return;
    this.resending.set(row.uid);
    this.notice.set(null);
    this.service
      .sendPasswordEmail(row.uid)
      .pipe(
        finalize(() => this.resending.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (sent) =>
          this.notice.set({
            kind: 'ok',
            text: `Se envió un correo a ${sent.email} para crear su contraseña.`,
          }),
        error: (error: unknown) =>
          this.notice.set({ kind: 'error', text: toApiError(error).message }),
      });
  }
}

function createdNotice(created: UserCreated): { kind: 'ok' | 'error'; text: string } {
  if (created.password_email_sent) {
    return { kind: 'ok', text: `Se envió un correo a ${created.email} para crear su contraseña.` };
  }
  return {
    kind: 'error',
    text: `Se creó la cuenta de ${created.email}, pero no se pudo enviar el correo. Usa «Reenviar correo» en su fila.`,
  };
}

function statusText(account: UserAccount, result: StatusChanged): string {
  const name = userName(account);
  if (!result.disabled) {
    return `La cuenta de ${name} está activa de nuevo: tendrá que iniciar sesión.`;
  }
  return result.sessions_revoked
    ? `La cuenta de ${name} quedó desactivada y se cerraron sus sesiones.`
    : `La cuenta de ${name} quedó desactivada; Firebase ya rechaza su acceso, aunque no se pudieron cerrar sus sesiones.`;
}

function assignedText(account: UserAccount, result: RoleAssigned): string {
  const done = `${userName(account)} ahora tiene el rol ${ROLE_LABELS[result.role]}.`;
  if (!result.known_user) {
    return `${done} Todavía no inicia sesión en Hermes: el rol aplica desde su primer acceso.`;
  }
  return result.sessions_revoked
    ? `${done} Se cerraron sus sesiones: tendrá que iniciar sesión de nuevo.`
    : `${done} No se pudieron cerrar sus sesiones; mientras su sesión actual siga vigente, su acceso queda limitado al menor de sus dos roles.`;
}
