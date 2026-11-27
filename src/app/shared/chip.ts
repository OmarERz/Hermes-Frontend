import { Component, input } from '@angular/core';
import type { Level } from './labels';

/**
 * Colour of a chip: a severity level, a semantic state, the violet of information, the accent or neutral. Each one
 * has a light and a dark pair of tokens (src/styles.css), at 4.5:1 or more on its own fill.
 */
export type ChipTone = Level | 'success' | 'warning' | 'danger' | 'violet' | 'accent' | 'neutral';

/**
 * Severity and status chip (F19.4, docs/front/diseno-ronda-1.md G10, REC-5): one shape for the levels, the urgencies
 * and the states of every screen, with a variant per theme. The text is projected (already in Spanish); the look lives
 * in src/styles/chips.css so it also wins over the prototype's scoped sheets.
 */
@Component({
  selector: 'app-chip',
  host: {
    class: 'ui-chip',
    '[attr.data-tone]': 'tone()',
  },
  template: '<ng-content />',
})
export class Chip {
  readonly tone = input<ChipTone>('neutral');
}
