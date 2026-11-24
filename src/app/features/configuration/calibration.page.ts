import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideClipboardCheck,
  LucideGauge,
  LucideScale,
  LucideShieldCheck,
  LucideTimer,
} from '@lucide/angular';
import { Subscription } from 'rxjs';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { ApiError, toApiError } from '../../core/api/api-error';
import { ACTION_ROLES } from '../../core/auth/roles';
import { SessionService } from '../../core/auth/session.service';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { ConfirmChangesDialog } from '../../shared/confirm-changes-dialog';
import { CursorPager } from '../../shared/cursor-pager';
import { formatDateTime } from '../../shared/labels';
import type { ChangeRow } from '../../shared/versioned-save';
import {
  approvalImpact,
  backtestSummary,
  kindLabel,
  proposalChanges,
  proposalStatusLabel,
} from './calibration-model';
import { ConfigApi } from './config-api';
import type { CalibrationProposal } from './config-model';
import { ConfigStore } from './config-store';

const PAGE_SIZE = 10;

type Decision = 'approve' | 'reject';

interface PendingDecision {
  proposal: CalibrationProposal;
  action: Decision;
}

/**
 * Calibración (mode 4, docs/07 §10): the weekly proposals of `GET /api/calibration/proposals`, newest first, with
 * their evidence, the before and after, and the 30-day replay. Nothing is applied until an administrator approves
 * it (D-020), even with the autonomous mode on; approving or rejecting goes through the before/after
 * confirmation. The mode and its limits are read from the configuration and changed in Parámetros.
 */
@Component({
  selector: 'app-calibration-page',
  providers: [ConfigStore],
  imports: [
    BannerPagina,
    AsyncStateComponent,
    ConfirmChangesDialog,
    RouterLink,
    LucideArrowLeft,
    LucideArrowRight,
    LucideClipboardCheck,
    LucideGauge,
    LucideShieldCheck,
    LucideTimer,
  ],
  templateUrl: './calibration-page.html',
  styleUrl: './calibration-page.css',
})
export class CalibrationPage {
  private readonly api = inject(ConfigApi);
  readonly store = inject(ConfigStore);
  private subscription: Subscription | null = null;

  readonly bannerIcon = LucideScale;
  private readonly session = inject(SessionService);
  /** Approve and reject are for administrators; the others see the proposals and their status. */
  readonly canDecide = computed(() => this.session.hasRole(ACTION_ROLES.decideCalibration));

  readonly mode = computed(() =>
    this.store.values()['mode4_autonomous'] === 'true' ? 'Autónoma' : 'Supervisada',
  );
  readonly weeklyLimit = computed(() => this.store.values()['mode4.weekly_limit'] ?? '—');
  readonly cooldownWeeks = computed(() => this.store.values()['mode4.cooldown_weeks'] ?? '—');

  readonly pager = new CursorPager<CalibrationProposal>((cursor) =>
    this.api.proposals(cursor, PAGE_SIZE),
  );
  readonly rows = computed(() =>
    this.pager.items().map((proposal) => ({
      proposal,
      kind: kindLabel(proposal.kind),
      status: proposalStatusLabel(proposal.status),
      when: formatDateTime(proposal.created_at),
      decidedWhen: proposal.decided_at ? formatDateTime(proposal.decided_at) : null,
      changes: proposalChanges(proposal, this.store.parameters()),
      backtest: backtestSummary(proposal.backtest),
    })),
  );
  readonly state = computed<ViewState | null>(() => {
    const status = this.pager.state.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.rows().length ? null : 'empty';
  });

  readonly target = signal<PendingDecision | null>(null);
  readonly deciding = signal(false);
  readonly decideError = signal<ApiError | null>(null);
  readonly notice = signal('');
  readonly dialogTitle = computed(() =>
    this.target()?.action === 'approve' ? 'Aprobar la propuesta' : 'Rechazar la propuesta',
  );
  readonly decisionRows = computed<ChangeRow[]>(() => {
    const target = this.target();
    if (!target) return [];
    if (target.action === 'reject') {
      return [
        {
          name: 'Estado de la propuesta',
          before: 'Pendiente',
          after: 'Rechazada',
          impact: 'No se aplica ningún cambio.',
        },
      ];
    }
    const rows = proposalChanges(target.proposal, this.store.parameters());
    return rows.map((row, index) =>
      index === 0 ? { ...row, impact: approvalImpact(target.proposal.kind) } : row,
    );
  });

  constructor() {
    this.store.load();
    this.pager.first();
    inject(DestroyRef).onDestroy(() => {
      this.pager.state.cancel();
      this.subscription?.unsubscribe();
    });
  }

  ask(proposal: CalibrationProposal, action: Decision): void {
    this.notice.set('');
    this.decideError.set(null);
    this.target.set({ proposal, action });
  }

  cancel(): void {
    if (this.deciding()) return;
    this.target.set(null);
    this.decideError.set(null);
  }

  confirm(): void {
    const target = this.target();
    if (!target || this.deciding()) return;
    const { proposal, action } = target;
    this.deciding.set(true);
    this.decideError.set(null);
    const call =
      action === 'approve' ? this.api.approve(proposal.id) : this.api.reject(proposal.id);
    this.subscription = call.subscribe({
      next: () => {
        this.deciding.set(false);
        this.target.set(null);
        this.notice.set(
          action === 'approve'
            ? `Se aprobó y aplicó la propuesta: ${proposal.summary}.`
            : `Se rechazó la propuesta: ${proposal.summary}.`,
        );
        // An approved weight change is a new configuration version.
        if (action === 'approve') this.store.load();
        this.pager.reload();
      },
      error: (error: unknown) => {
        const failure = toApiError(error);
        this.deciding.set(false);
        this.decideError.set(failure);
        // Someone decided it already, or what it changes moved: show the proposal as it is now.
        if (failure.status === 404 || failure.status === 409) this.pager.reload();
      },
    });
  }
}
