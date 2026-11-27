import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/** The selected item of a row: the tab of the current page, a pressed button or an active link. */
const SELECTED = '[aria-current="page"], [aria-pressed="true"], .active';
/** Scroll positions are fractional: closer than this to an edge counts as reaching it. */
const SLACK = 1;

export type FadeEdges = 'start' | 'end' | 'both';

/** The edges of a horizontal scroller that hide content (null when everything is in view). */
export function fadeEdges(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): FadeEdges | null {
  const hiddenStart = scrollLeft > SLACK;
  const hiddenEnd = scrollLeft + clientWidth < scrollWidth - SLACK;
  if (hiddenStart && hiddenEnd) return 'both';
  if (hiddenStart) return 'start';
  return hiddenEnd ? 'end' : null;
}

/**
 * A row that scrolls sideways when it does not fit (the segmented control, src/styles/segmented.css): marks the edges
 * that hide content with data-fade="start|end|both", so the styles fade them, and brings the selected item into view
 * when part of it is cut off (the current tab of a long section on a phone, also after the row narrows). It follows
 * scrolling, resizing and changes of its items (labels, counts, selection) without running change detection.
 */
@Directive({ selector: '[appScrollFade]' })
export class ScrollFade {
  private readonly element: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.reveal();
      this.update();
      const onScroll = () => this.update();
      this.element.addEventListener('scroll', onScroll, { passive: true });
      const mutations = new MutationObserver((records) => {
        if (records.some((record) => record.type === 'attributes')) this.reveal();
        this.update();
      });
      mutations.observe(this.element, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'aria-current', 'aria-pressed'],
      });
      const resizes =
        typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(() => {
              this.reveal();
              this.update();
            });
      resizes?.observe(this.element);
      destroyRef.onDestroy(() => {
        this.element.removeEventListener('scroll', onScroll);
        mutations.disconnect();
        resizes?.disconnect();
      });
    });
  }

  /** Marks the edges that hide content (data-fade), or clears the mark when everything is in view. */
  update(): void {
    const { scrollLeft, scrollWidth, clientWidth } = this.element;
    const edges = fadeEdges(scrollLeft, scrollWidth, clientWidth);
    if (!edges) this.element.removeAttribute('data-fade');
    else if (this.element.getAttribute('data-fade') !== edges)
      this.element.setAttribute('data-fade', edges);
  }

  /** Scrolls the selected item to the middle of the row when part of it is out of view. */
  reveal(): void {
    const selected = this.element.querySelector<HTMLElement>(SELECTED);
    if (!selected) return;
    const row = this.element.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    if (item.left >= row.left && item.right <= row.right) return;
    this.element.scrollLeft += item.left - row.left - (row.width - item.width) / 2;
  }
}
