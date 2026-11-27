import { booleanAttribute, Component, input, model } from '@angular/core';
import { LucideColumns3 } from '@lucide/angular';

/**
 * «Todas las columnas» (F19.5, docs/front/diseno-ronda-1.md G14): a table that hides its priority columns until it is
 * wide enough (src/styles/tables.css) and has no detail of the row where their data lives shows them all while this is
 * pressed (the table takes `[class.all-columns]`, and scrolls sideways if it must). Its name never changes; its state
 * is aria-pressed. The styles (src/styles/tables.css) hide it where it does nothing: on windows wide enough for every
 * column, and on phones for a table shown as cards (phoneCards), which already show every field.
 */
@Component({
  selector: 'app-columns-toggle',
  imports: [LucideColumns3],
  host: { '[attr.data-phone-cards]': "phoneCards() ? '' : null" },
  template: `<button
    type="button"
    class="btn btn-secondary btn-sm columns-toggle"
    [attr.aria-pressed]="all()"
    [attr.aria-controls]="controls()"
    (click)="all.set(!all())"
  >
    <svg lucideColumns3 aria-hidden="true"></svg> Todas las columnas
  </button>`,
})
export class ColumnsToggle {
  /** Every column shown. */
  readonly all = model(false);
  /** Id of the table (or tables, space separated) it shows the columns of. */
  readonly controls = input<string | null>(null);
  /** The table is a list of cards on phones (.cards-mobile), which already shows every field there. */
  readonly phoneCards = input(false, { transform: booleanAttribute });
}
