import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideArrowRight, LucideGitCompareArrows } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { ACTION_ROLES } from '../../core/auth/roles';
import { SessionService } from '../../core/auth/session.service';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import { formatDateTime, LEVEL_LABELS, LEVELS, type Level } from '../../shared/labels';
import type { FeedbackResult, Recommendation } from './feedback';
import { FeedbackDialog } from './feedback-dialog';
import { filterPage, groupByVulnerability, type RecommendationGroup } from './grouping';
import { RecommendationCard } from './recommendation-card';
import { RecommendationsService, type RecommendationScope } from './recommendations.service';

const PAGE_SIZE = 50;

/** Query parameters a direct link may carry: one evaluation, or the timeline of a group or a CI (FRO-12). */
function linkOf(params: ParamMap): { id: string | null; scope: RecommendationScope } {
  const scope: RecommendationScope = {};
  const groupId = params.get('group_id');
  const ciId = params.get('ci_id');
  if (groupId) scope.group_id = groupId;
  if (ciId) scope.ci_id = ciId;
  // `recomendacionId` is the prototype's link (also reached through the old /revision-humana path).
  return { id: params.get('id') || params.get('recomendacionId') || null, scope };
}

/**
 * Recomendaciones (F17.4, FRO-12 to FRO-15): the recommendation history of `GET /api/recommendations` grouped by
 * vulnerability (RE-1), with level and «sin feedback» filters (RE-2) and the detail of each evaluation. Reconverts
 * the prototype's Recomendaciones and Revisión humana screens (same `recommendations-view` design); feedback
 * replaces the human approval, and it never changes a score by itself (FRO-15).
 */
@Component({
  selector: 'app-recommendations-page',
  imports: [
    FormsModule,
    RouterLink,
    BannerPagina,
    AsyncStateComponent,
    FeedbackDialog,
    RecommendationCard,
    LucideArrowLeft,
    LucideArrowRight,
    LucideGitCompareArrows,
  ],
  templateUrl: './recommendations-page.html',
  styleUrl: './recommendations-page.css',
})
export class RecommendationsPage {
  private readonly service = inject(RecommendationsService);
  /** Feedback (`POST /api/feedback`) is for analyst or admin; a lower role never gets the dialog. */
  readonly session = inject(SessionService);
  readonly feedbackRole = ACTION_ROLES.giveFeedback;

  readonly bannerIcon = LucideGitCompareArrows;
  readonly levels = LEVELS;
  readonly levelLabels = LEVEL_LABELS;

  readonly scope = signal<RecommendationScope>({});
  readonly level = signal<Level | ''>('');
  readonly withoutFeedback = signal(false);
  private readonly selectedKey = signal<string | null>(null);

  /** The evaluation of a direct link (`?id=`), shown until the person picks a case of the list. */
  readonly linked = new AsyncState<Recommendation>();
  private readonly linkedId = signal<string | null>(null);
  readonly showLinked = signal(false);

  /** The evaluation the feedback dialog is open for, the last save message and a counter of saves. */
  readonly feedbackTarget = signal<Recommendation | null>(null);
  readonly savedMessage = signal('');
  readonly feedbackSaves = signal(0);

  readonly pager = new CursorPager<Recommendation>((cursor) =>
    this.service.list(this.scope(), cursor, PAGE_SIZE),
  );

  readonly visible = computed(() =>
    filterPage(this.pager.items(), {
      level: this.level(),
      withoutFeedback: this.withoutFeedback(),
    }),
  );
  readonly groups = computed(() => groupByVulnerability(this.visible()));
  readonly hasFilters = computed(() => this.level() !== '' || this.withoutFeedback());

  readonly listState = computed<ViewState | null>(() => {
    const status = this.pager.state.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.groups().length ? null : 'empty';
  });

  readonly emptyText = computed(() =>
    this.pager.items().length
      ? 'Ninguna evaluación de esta página cumple los filtros.'
      : 'Aún no hay recomendaciones.',
  );

  readonly activeGroup = computed<RecommendationGroup | null>(() => {
    if (this.showLinked()) {
      const linked = this.linked.value();
      return linked && this.linked.status() === 'ready' ? groupByVulnerability([linked])[0] : null;
    }
    const groups = this.groups();
    return groups.find((group) => group.key === this.selectedKey()) ?? groups[0] ?? null;
  });

  /** While a direct link loads or fails, the detail shows its state instead of a case of the list. */
  readonly linkedState = computed<ViewState | null>(() => {
    if (!this.showLinked()) return null;
    const status = this.linked.status();
    return status === 'ready' ? null : status === 'error' ? 'error' : 'loading';
  });

  readonly scopeLabel = computed(() => {
    const scope = this.scope();
    if (scope.group_id) return 'Línea de tiempo de una vulnerabilidad';
    if (scope.ci_id) return `Línea de tiempo del activo ${scope.ci_id}`;
    return null;
  });

  constructor() {
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => this.open(params));
    inject(DestroyRef).onDestroy(() => {
      this.pager.state.cancel();
      this.linked.cancel();
    });
  }

  private open(params: ParamMap): void {
    const { id, scope } = linkOf(params);
    this.scope.set(scope);
    this.selectedKey.set(null);
    this.linkedId.set(id);
    this.showLinked.set(id !== null);
    this.loadLinked();
    this.pager.first();
  }

  loadLinked(): void {
    const id = this.linkedId();
    if (id) this.linked.run(this.service.get(id));
    else this.linked.cancel();
  }

  selectGroup(group: RecommendationGroup): void {
    this.showLinked.set(false);
    this.selectedKey.set(group.key);
  }

  isActive(group: RecommendationGroup): boolean {
    return this.activeGroup()?.key === group.key;
  }

  /** Newest evaluation of a case, for its summary line. */
  latestOf(group: RecommendationGroup): Recommendation {
    return group.items[0];
  }

  formatDate(iso: string): string {
    return formatDateTime(iso);
  }

  openFeedback(recommendation: Recommendation): void {
    this.savedMessage.set('');
    this.feedbackTarget.set(recommendation);
  }

  /** After a save: say so, and read the counts and any open history again (the score never changes). */
  onFeedbackSaved(result: FeedbackResult): void {
    this.savedMessage.set(
      result.replaced_previous
        ? 'Feedback guardado. Reemplaza tu feedback anterior sobre esta evaluación.'
        : 'Feedback guardado.',
    );
    this.feedbackSaves.update((count) => count + 1);
    this.pager.reload();
    if (this.showLinked()) this.loadLinked();
  }

  clearFilters(): void {
    this.level.set('');
    this.withoutFeedback.set(false);
  }
}
