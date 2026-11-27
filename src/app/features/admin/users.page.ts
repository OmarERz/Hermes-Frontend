import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideChevronDown,
  LucideRefreshCw,
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
import { ConfirmChangesDialog } from '../../shared/confirm-changes-dialog';
import { CursorPager } from '../../shared/cursor-pager';
import { formatDateTime } from '../../shared/labels';
import type { ChangeRow } from '../../shared/versioned-save';
import { RoleAssigned, UserAccount, UsersService } from './users.service';

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
  effectiveTone: 'ok' | 'bad' | 'accent';
  active: boolean;
  lastLogin: string;
  own: boolean;
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
    storedRole: account.signed_in
      ? roleLabel(account.role, 'Sin rol guardado')
      : 'Nunca inició sesión',
    claimRole: roleLabel(account.claim_role, 'Sin claim'),
    effectiveRole: roleLabel(account.effective_role, 'Sin acceso'),
    effectiveTone: !account.effective_role
      ? 'bad'
      : account.effective_role === 'admin'
        ? 'accent'
        : 'ok',
    active: account.active,
    lastLogin: account.last_login_at ? formatDateTime(account.last_login_at) : 'Nunca',
    own: ownUid !== null && account.uid === ownUid,
  };
}

/** Codes after which the row the admin read is stale: the dialog closes and the list is read again. */
const STALE_CODES = new Set(['role_changed', 'user_not_found']);

/**
 * Usuarios y roles (FRONTEND.md §2 and §5, D-030): every Firebase account of `GET /api/admin/users`, signed in or
 * not, with its stored role (the copy in Hermes), the role of its Firebase claim and its effective role (the lower of
 * both: the one its requests get). An admin changes a role with `PUT /api/admin/users/{uid}/role`, sending the stored
 * role as `expected_role`; the backend revokes that person's sessions. Nobody changes their own role (409 `own_role`),
 * so the own row has no control.
 */
@Component({
  selector: 'app-users-page',
  imports: [
    BannerPagina,
    AsyncStateComponent,
    ConfirmChangesDialog,
    IfRoleDirective,
    LucideArrowLeft,
    LucideArrowRight,
    LucideChevronDown,
    LucideRefreshCw,
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
