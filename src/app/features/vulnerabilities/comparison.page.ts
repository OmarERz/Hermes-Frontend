import { Component, computed, DestroyRef, inject } from '@angular/core';
import { LucideArrowLeft, LucideArrowRight, LucideScale } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent, ViewState } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import { LEVEL_LABELS, LEVELS, type Level } from '../../shared/labels';
import { ComparisonRow, ComparisonService, ComparisonSummary } from './comparison.service';
import { FUNNEL_LABELS, FUNNEL_ORDER, signed } from './vulnerability-texts';

const PAGE_SIZE = 25;

function rank(level: Level): number {
  return LEVELS.indexOf(level);
}

/**
 * Raw versus processed (D-039, MET-24 to MET-27): what a CVSS-only scanner would say against the final urgency of
 * Hermes. Levels are compared by name, each on its own scale (EVA-13); the per-asset Δ waterfall is in the
 * vulnerability detail.
 */
@Component({
  selector: 'app-comparison-page',
  imports: [BannerPagina, AsyncStateComponent, LucideArrowLeft, LucideArrowRight],
  templateUrl: './comparison.page.html',
  styleUrls: ['./vulnerability-chips.css', './comparison.page.css'],
})
export class ComparisonPage {
  private readonly service = inject(ComparisonService);

  readonly bannerIcon = LucideScale;
  readonly levels = LEVELS;
  readonly levelLabels = LEVEL_LABELS;
  readonly signed = signed;

  readonly summary = new AsyncState<ComparisonSummary>();
  readonly pager = new CursorPager<ComparisonRow>((cursor) => this.service.rows(cursor, PAGE_SIZE));

  readonly summaryState = computed<ViewState | null>(() => {
    const status = this.summary.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    return status === 'error' ? 'error' : null;
  });

  /** 4 × 4 cells: CVSS level (row) → Hermes level (column) → count, with the direction of the change. */
  readonly matrix = computed(() => {
    const matrix = this.summary.value()?.reclassification_matrix ?? {};
    return LEVELS.map((from) => ({
      from,
      cells: LEVELS.map((to) => ({
        to,
        count: matrix[from]?.[to] ?? 0,
        change: rank(to) < rank(from) ? 'up' : rank(to) > rank(from) ? 'down' : 'same',
      })),
    }));
  });

  readonly funnel = computed(() => {
    const funnel = this.summary.value()?.funnel ?? {};
    const keys = [
      ...FUNNEL_ORDER.filter((key) => key in funnel),
      ...Object.keys(funnel).filter((key) => !FUNNEL_ORDER.includes(key)),
    ];
    const top = Math.max(1, ...keys.map((key) => funnel[key] ?? 0));
    return keys.map((key) => ({
      key,
      label: FUNNEL_LABELS[key] ?? key,
      count: funnel[key] ?? 0,
      percent: Math.round(((funnel[key] ?? 0) / top) * 100),
    }));
  });

  readonly tableState = computed<ViewState | null>(() => {
    const status = this.pager.state.status();
    if (status === 'idle' || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    return this.pager.items().length ? null : 'empty';
  });

  constructor() {
    this.reload();
    inject(DestroyRef).onDestroy(() => {
      this.summary.cancel();
      this.pager.state.cancel();
    });
  }

  reload(): void {
    this.summary.run(this.service.summary());
    this.pager.first();
  }
}
