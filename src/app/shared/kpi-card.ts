import { booleanAttribute, Component, computed, input } from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { AyudaTooltip } from '../componentes/ayuda-tooltip/ayuda-tooltip';
import type { LoadStatus } from './async-state';

/** Colour of the icon tile: the accent, a semantic colour or a severity level. */
export type KpiTone =
  'accent' | 'violet' | 'success' | 'warning' | 'danger' | 'critical' | 'high' | 'medium' | 'low';

/** What the card shows in place of its value: the value, a loading placeholder or «Sin datos». */
export type KpiState = 'ready' | 'loading' | 'error';

/** The card state of an AsyncState load: idle counts as loading (the load has not answered yet). */
export function kpiState(status: LoadStatus): KpiState {
  if (status === 'ready' || status === 'error') return status;
  return 'loading';
}

/**
 * Indicator card (F19.4, docs/front/diseno-ronda-1.md VUL-3, COM-1, COR-2, MET-1): one look for the indicators of
 * every screen. Optional icon tile at the top left, the label (with an optional help button) and an optional note on
 * top, and the value at the bottom: the cards of a row are as tall as the tallest, so their values line up whatever
 * the length of the labels. Figures use tabular numbers. A missing value (null) reads «—»; while loading, a
 * placeholder bar with «Cargando…» for screen readers; on an error, «Sin datos». Anything projected (a chip, a small
 * button) goes next to the value. Put the cards in a `.kpi-grid` (src/styles/kpi.css).
 */
@Component({
  selector: 'app-kpi-card',
  imports: [LucideDynamicIcon, AyudaTooltip],
  host: {
    class: 'kpi-card',
    '[class.kpi-has-icon]': '!!icon()',
    '[class.kpi-nested]': 'nested()',
    '[attr.aria-busy]': "state() === 'loading' || null",
  },
  template: `
    @if (icon(); as glyph) {
      <span class="kpi-icon" [attr.data-tone]="tone()"
        ><svg [lucideIcon]="glyph" aria-hidden="true"></svg
      ></span>
    }
    <span class="kpi-label"
      >{{ label() }}
      @if (help(); as text) {
        <app-ayuda-tooltip [texto]="text" />
      }
    </span>
    @if (note(); as text) {
      <span class="kpi-note">{{ text }}</span>
    }
    <span class="kpi-value-row">
      @switch (state()) {
        @case ('loading') {
          <span class="kpi-value kpi-pending"
            ><span class="kpi-placeholder" aria-hidden="true"></span
            ><span class="kpi-sr-only">Cargando…</span></span
          >
        }
        @case ('error') {
          <span class="kpi-value kpi-pending">Sin datos</span>
        }
        @default {
          <span
            class="kpi-value"
            [class.kpi-text]="kind() === 'text'"
            [class.kpi-pending]="missing()"
            >{{ shown() }}</span
          >
        }
      }
      <ng-content />
    </span>
  `,
  styles: `
    :host {
      position: relative;
      container-type: inline-size;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto 1fr;
      column-gap: var(--space-3);
      row-gap: var(--stack-xs);
      min-width: 0;
      box-sizing: border-box;
      padding: var(--card-pad-compact);
      border: 1px solid transparent;
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: var(--shadow-1);
      color: var(--text-primary);
    }
    :host(.kpi-has-icon) {
      grid-template-columns: auto minmax(0, 1fr);
    }
    :host(.kpi-nested) {
      padding: var(--space-3);
      border-radius: var(--radius-md);
      background: var(--surface-soft);
      box-shadow: none;
    }
    .kpi-icon {
      grid-row: 1 / span 3;
      align-self: start;
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--accent-wash);
      color: var(--accent);
    }
    .kpi-icon svg {
      width: 22px;
      height: 22px;
      stroke-width: 1.9;
    }
    .kpi-icon[data-tone='violet'] {
      background: var(--violet-wash);
      color: var(--accent-violet);
    }
    .kpi-icon[data-tone='success'] {
      background: var(--success-bg);
      color: var(--success-text);
    }
    .kpi-icon[data-tone='warning'] {
      background: var(--warning-bg);
      color: var(--warning-text);
    }
    .kpi-icon[data-tone='danger'] {
      background: var(--danger-bg);
      color: var(--danger-text);
    }
    .kpi-icon[data-tone='critical'] {
      background: var(--sev-critical-bg);
      color: var(--sev-critical-text);
    }
    .kpi-icon[data-tone='high'] {
      background: var(--sev-high-bg);
      color: var(--sev-high-text);
    }
    .kpi-icon[data-tone='medium'] {
      background: var(--sev-medium-bg);
      color: var(--sev-medium-text);
    }
    .kpi-icon[data-tone='low'] {
      background: var(--sev-low-bg);
      color: var(--sev-low-text);
    }
    /* Block text with the help button inline at its end (it never drops to a line of its own). */
    .kpi-label {
      display: block;
      min-width: 0;
      color: var(--text-secondary);
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      line-height: var(--leading-snug);
      text-wrap: pretty;
    }
    .kpi-label app-ayuda-tooltip {
      margin-left: var(--space-0-5);
    }
    .kpi-note {
      color: var(--text-muted);
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      text-wrap: pretty;
    }
    .kpi-value-row {
      align-self: end;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-1) var(--space-2);
      min-width: 0;
      margin-top: var(--space-1);
    }
    .kpi-value {
      color: var(--text-primary);
      font-size: var(--text-3xl);
      font-weight: var(--weight-bold);
      font-variant-numeric: tabular-nums;
      line-height: var(--leading-tight);
      letter-spacing: -0.02em;
      overflow-wrap: anywhere;
    }
    .kpi-value.kpi-text {
      font-size: var(--text-xl);
      font-weight: var(--weight-semibold);
      letter-spacing: 0;
    }
    .kpi-value.kpi-pending {
      color: var(--text-muted);
      font-size: var(--text-md);
      font-weight: var(--weight-semibold);
      letter-spacing: 0;
    }
    .kpi-placeholder {
      display: block;
      width: 64px;
      height: calc(var(--text-3xl) * var(--leading-tight));
      border-radius: var(--radius-sm);
      background: linear-gradient(
        90deg,
        var(--surface-raised) 0%,
        var(--surface-soft) 50%,
        var(--surface-raised) 100%
      );
      background-size: 200% 100%;
      animation: kpi-shimmer 1.4s ease-in-out infinite;
    }
    .kpi-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    /*
     * A narrow card (two columns on a phone, five in a panel): a smaller tile next to the label, and the note and the
     * value across the whole card, so the label is not squeezed into a column beside the tile.
     */
    @container (max-width: 180px) {
      .kpi-icon {
        grid-row: auto;
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
      }
      .kpi-icon svg {
        width: 18px;
        height: 18px;
      }
      .kpi-label {
        align-self: center;
      }
      .kpi-note,
      .kpi-value-row {
        grid-column: 1 / -1;
      }
    }
    @keyframes kpi-shimmer {
      from {
        background-position: 100% 0;
      }
      to {
        background-position: -100% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .kpi-placeholder {
        animation: none;
      }
    }
  `,
})
export class KpiCard {
  readonly label = input.required<string>();
  /** The value as the screen formats it; null or undefined reads «—». */
  readonly value = input<string | number | null | undefined>(null);
  readonly icon = input<LucideIconInput | null>(null);
  readonly tone = input<KpiTone>('accent');
  readonly state = input<KpiState>('ready');
  /** 'text' for a word or a date (a smaller size than a figure). */
  readonly kind = input<'number' | 'text'>('number');
  /** A short line under the label that says what the figure counts. */
  readonly note = input<string | null>(null);
  /** Text of the help button next to the label. */
  readonly help = input<string | null>(null);
  /** A card inside a panel: soft fill, no shadow (G9). */
  readonly nested = input(false, { transform: booleanAttribute });

  readonly missing = computed(() => {
    const value = this.value();
    return value === null || value === undefined || value === '';
  });
  readonly shown = computed(() => (this.missing() ? '—' : String(this.value())));
}
