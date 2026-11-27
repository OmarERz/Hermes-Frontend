import { computed, Signal, signal } from '@angular/core';

/** One card of the carousel: its position relative to the centre (-2 to 2) and a stable track key. */
export interface CarouselCard<T> {
  virtualIndex: number;
  offset: number;
  item: T;
}

/**
 * Circular carousel of the prototype's Feeds screen, over any list of items with an id. The selection follows the
 * item (not the position), so it survives a reload or a filter change while the item is still in the list; the
 * virtual index keeps the slide animation going the right way when the carousel wraps around.
 */
export class CarouselState<T extends { id: string }> {
  private readonly virtualIndex = signal(0);
  private readonly selectedId = signal<string | null>(null);

  constructor(private readonly items: Signal<readonly T[]>) {}

  readonly selectedIndex = computed(() => {
    const items = this.items();
    if (!items.length) return 0;
    const byId = items.findIndex((item) => item.id === this.selectedId());
    if (byId >= 0) return byId;
    return ((this.virtualIndex() % items.length) + items.length) % items.length;
  });

  readonly selected = computed<T | null>(() => this.items()[this.selectedIndex()] ?? null);

  /** Offsets shown around the centre: up to two neighbours per side, never the same item twice. */
  private readonly offsets = computed(() => {
    const count = this.items().length;
    if (count === 0) return [];
    if (count === 1) return [0];
    if (count === 2) return [0, 1];
    const radius = Math.min(2, Math.floor((count - 1) / 2));
    return Array.from({ length: radius * 2 + 1 }, (_, index) => index - radius);
  });

  readonly cards = computed<CarouselCard<T>[]>(() => {
    const items = this.items();
    if (!items.length) return [];
    return this.offsets().map((offset) => ({
      virtualIndex: this.virtualIndex() + offset,
      offset,
      item: items[(this.selectedIndex() + offset + items.length) % items.length],
    }));
  });

  /** Centres the item, keeping the visual offset of the card that was clicked. */
  select(id: string, virtualIndex = this.virtualIndex()): void {
    if (!this.items().some((item) => item.id === id)) return;
    this.selectedId.set(id);
    this.virtualIndex.set(virtualIndex);
  }

  /** Back to the first item (after a filter change). */
  reset(): void {
    this.virtualIndex.set(0);
    this.selectedId.set(this.items()[0]?.id ?? null);
  }

  /** One step left or right, wrapping around both ends. */
  move(direction: -1 | 1): void {
    const items = this.items();
    if (!items.length) return;
    const next = (this.selectedIndex() + direction + items.length) % items.length;
    this.selectedId.set(items[next].id);
    this.virtualIndex.update((index) => index + direction);
  }
}
