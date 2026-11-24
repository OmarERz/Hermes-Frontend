import { Component, computed, input, output } from '@angular/core';
import { LucideDynamicIcon, LucideIconInput, LucideLock } from '@lucide/angular';
import { ConfigParameter, optionLabel } from './config-model';

/** Step of a range slider: whole numbers for integers, a fine step for small decimal ranges. */
function stepOf(param: ConfigParameter): string {
  if (param.type === 'integer') return '1';
  const span = Number(param.max) - Number(param.min);
  if (span <= 1) return '0.01';
  return span <= 10 ? '0.1' : '1';
}

const SLIDER_SPAN_LIMIT = 1000;

/**
 * One parameter of `GET /api/config/schema` as a control chosen by its type: a range slider for a bounded number
 * (with a number field for exact values in the compact row), a switch for a boolean, a list for an enum and a text
 * field for a string. Disabled when the role does not reach `min_role`; a `blocked` parameter shows 🔒 and is
 * never editable. The card variant keeps the prototype's slider card with its meter.
 */
@Component({
  selector: 'app-config-field',
  imports: [LucideDynamicIcon, LucideLock],
  templateUrl: './config-field.html',
  styleUrl: './config-field.css',
})
export class ConfigField {
  readonly param = input.required<ConfigParameter>();
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly editable = input(false);
  readonly changed = input(false);
  readonly error = input<string | null | undefined>(null);
  readonly variant = input<'card' | 'row'>('row');
  readonly icon = input<LucideIconInput | null>(null);
  readonly valueChange = output<string>();

  readonly id = computed(() => 'cfg-' + this.param().key.replace(/[^a-zA-Z0-9_-]/g, '-'));
  readonly errorId = computed(() => this.id() + '-error');
  readonly blocked = computed(() => this.param().level === 'blocked');
  readonly hasRange = computed(() => {
    const { min, max } = this.param();
    if (min === null || min === undefined || max === null || max === undefined) return false;
    const span = Number(max) - Number(min);
    return Number.isFinite(span) && span > 0 && span <= SLIDER_SPAN_LIMIT;
  });
  /** The prototype's slider card: a bounded number in the card variant. */
  readonly sliderCard = computed(
    () =>
      this.variant() === 'card' &&
      (this.param().type === 'decimal' || this.param().type === 'integer') &&
      this.hasRange(),
  );
  readonly step = computed(() => stepOf(this.param()));
  readonly bounds = computed(() => {
    const { min, max } = this.param();
    const hasMin = min !== null && min !== undefined;
    const hasMax = max !== null && max !== undefined;
    if (hasMin && hasMax) return `${min} – ${max}`;
    if (hasMin) return `mínimo ${min}`;
    return hasMax ? `máximo ${max}` : '';
  });
  /** Position of the value in its range, 0 to 100, for the meter and the slider fill. */
  readonly percent = computed(() => {
    const { min, max } = this.param();
    const value = Number(this.value());
    const low = Number(min);
    const high = Number(max);
    if (!Number.isFinite(value) || !(high > low)) return 0;
    return Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
  });
  readonly sliderValue = computed(() =>
    Number.isFinite(Number(this.value())) && this.value().trim() !== ''
      ? this.value()
      : (this.param().min ?? '0'),
  );

  optionLabel(option: string): string {
    return optionLabel(this.param().key, option);
  }

  emit(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    // A number field reports '' while its text is not a number yet ('0.' on the way to '0.35'): emitting it would
    // clear the draft, and the binding would then wipe what the person is typing.
    if (target.validity?.badInput) return;
    this.valueChange.emit(target.value);
  }

  toggle(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).checked ? 'true' : 'false');
  }
}
