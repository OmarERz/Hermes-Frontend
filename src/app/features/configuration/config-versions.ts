import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideArrowLeft, LucideArrowRight, LucideHistory } from '@lucide/angular';
import { Subscription } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { ACTION_ROLES } from '../../core/auth/roles';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { ConfirmChangesDialog } from '../../shared/confirm-changes-dialog';
import { CursorPager } from '../../shared/cursor-pager';
import { formatDateTime } from '../../shared/labels';
import type { ChangeRow } from '../../shared/versioned-save';
import { ConfigApi } from './config-api';
import type { ConfigVersion } from './config-model';
import { ConfigStore } from './config-store';

const PAGE_SIZE = 10;

/**
 * Configuration versions with who and when (FRO-07), newest first, and restore (admin): the chosen version
 * becomes current again as a new version, with the version the screen read (`expected_version`, API-03).
 * Restoring a formula queues a recalculation without the judge (FRO-08). Uses the page's ConfigStore.
 */
@Component({
  selector: 'app-config-versions',
  imports: [
    AsyncStateComponent,
    ConfirmChangesDialog,
    IfRoleDirective,
    LucideArrowLeft,
    LucideArrowRight,
    LucideHistory,
  ],
  templateUrl: './config-versions.html',
  styleUrl: './config-versions.css',
})
export class ConfigVersions {
  private readonly api = inject(ConfigApi);
  readonly store = inject(ConfigStore);
  private subscription: Subscription | null = null;

  /** Emitted after a restore: the page drops its draft (it was made on the old values). */
  readonly restored = output<number>();

  readonly restoreRole = ACTION_ROLES.restoreConfigVersion;
  readonly pager = new CursorPager<ConfigVersion>((cursor) => this.api.versions(cursor, PAGE_SIZE));
  readonly rows = computed(() =>
    this.pager.items().map((entry) => ({ ...entry, when: formatDateTime(entry.created_at) })),
  );
  readonly state = computed<ViewState | null>(() => {
    const status = this.pager.state.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.rows().length ? null : 'empty';
  });

  readonly target = signal<ConfigVersion | null>(null);
  readonly restoring = signal(false);
  readonly restoreError = signal<ApiError | null>(null);
  readonly notice = signal('');
  readonly restoreRows = computed<ChangeRow[]>(() => {
    const target = this.target();
    const current = this.store.version();
    if (!target || current === null) return [];
    return [
      {
        name: 'Configuración vigente',
        before: `Versión ${current}`,
        after: `Versión ${current + 1}, con los valores de la versión ${target.version}`,
        impact:
          'Si la fórmula cambia, se recalculan las puntuaciones base sin llamar al juez (corrida de recálculo).',
      },
    ];
  });

  constructor() {
    // Every new current version (a save, a restore or a reload) can add a row: read the first page again.
    effect(() => {
      if (this.store.version() !== null) untracked(() => this.pager.first());
    });
    inject(DestroyRef).onDestroy(() => {
      this.pager.state.cancel();
      this.subscription?.unsubscribe();
    });
  }

  ask(entry: ConfigVersion): void {
    this.notice.set('');
    this.restoreError.set(null);
    this.target.set(entry);
  }

  cancel(): void {
    if (this.restoring()) return;
    this.target.set(null);
    this.restoreError.set(null);
  }

  confirm(): void {
    const target = this.target();
    const current = this.store.version();
    if (!target || current === null || this.restoring()) return;
    this.restoring.set(true);
    this.restoreError.set(null);
    this.subscription = this.api.restore(target.version, current).subscribe({
      next: (document) => {
        this.restoring.set(false);
        this.target.set(null);
        this.store.accept(document);
        this.notice.set(
          `Se restauró la versión ${target.version} como la versión ${document.version}.`,
        );
        this.restored.emit(document.version);
      },
      error: (error: unknown) => {
        this.restoring.set(false);
        this.restoreError.set(toApiError(error));
      },
    });
  }

  /** After a 409 `version_conflict`: read the current version again. */
  reload(): void {
    this.target.set(null);
    this.restoreError.set(null);
    this.store.load();
  }
}
