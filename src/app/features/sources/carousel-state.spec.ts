import { signal } from '@angular/core';
import { CarouselState } from './carousel-state';

interface Item {
  id: string;
}

const items = (...ids: string[]): Item[] => ids.map((id) => ({ id }));

describe('CarouselState', () => {
  it('shows up to two neighbours per side and wraps around both ends', () => {
    const list = signal(items('a', 'b', 'c', 'd', 'e'));
    const carousel = new CarouselState(list);
    expect(carousel.cards().map((card) => [card.offset, card.item.id])).toEqual([
      [-2, 'd'],
      [-1, 'e'],
      [0, 'a'],
      [1, 'b'],
      [2, 'c'],
    ]);
    carousel.move(-1);
    expect(carousel.selected()?.id).toBe('e');
    carousel.move(1);
    carousel.move(1);
    expect(carousel.selected()?.id).toBe('b');
  });

  it('follows the selected item when the list changes, and resets to the first one', () => {
    const list = signal(items('a', 'b', 'c'));
    const carousel = new CarouselState(list);
    carousel.select('c', 2);
    list.set(items('c', 'd'));
    expect(carousel.selected()?.id).toBe('c');
    carousel.select('missing');
    expect(carousel.selected()?.id).toBe('c');
    carousel.reset();
    expect(carousel.selected()?.id).toBe('c');
    list.set(items('x', 'y', 'z'));
    carousel.reset();
    expect(carousel.selected()?.id).toBe('x');
  });

  it('handles empty, single and two-item lists without repeating a card', () => {
    const list = signal<Item[]>([]);
    const carousel = new CarouselState(list);
    expect(carousel.cards()).toEqual([]);
    expect(carousel.selected()).toBeNull();
    carousel.move(1);

    list.set(items('a'));
    expect(carousel.cards().map((card) => card.item.id)).toEqual(['a']);

    list.set(items('a', 'b'));
    const ids = carousel.cards().map((card) => card.item.id);
    expect(new Set(ids).size).toBe(2);
    carousel.move(1);
    expect(carousel.selected()?.id).toBe('b');
    carousel.move(1);
    expect(carousel.selected()?.id).toBe('a');
  });
});
