import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fadeEdges, ScrollFade } from './scroll-fade.directive';

@Component({
  imports: [ScrollFade],
  template: `
    <div class="row" appScrollFade [appScrollFadeReveal]="reveal()">
      <button type="button" [attr.aria-pressed]="selected() === 'a'">A</button>
      <button type="button" [attr.aria-pressed]="selected() === 'b'">{{ label() }}</button>
    </div>
  `,
})
class Host {
  readonly reveal = signal(true);
  readonly selected = signal<'a' | 'b'>('a');
  readonly label = signal('B');
}

interface Size {
  scrollWidth: number;
  clientWidth: number;
}

/** jsdom lays nothing out: the row's widths and scroll position come from `size` and a settable scrollLeft. */
function layOut(row: HTMLElement, size: Size): void {
  let left = 0;
  Object.defineProperty(row, 'scrollWidth', { configurable: true, get: () => size.scrollWidth });
  Object.defineProperty(row, 'clientWidth', { configurable: true, get: () => size.clientWidth });
  Object.defineProperty(row, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: (value: number) => (left = value),
  });
}

function place(element: Element, left: number, width: number): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left,
    right: left + width,
    width,
    top: 0,
    bottom: 40,
    height: 40,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

/** Lets the MutationObserver callbacks run. */
const mutationsSettle = () => new Promise((resolve) => setTimeout(resolve));

async function render(size: Size, firstButtonLeft = 10, reveal = true) {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.reveal.set(reveal);
  const element = fixture.nativeElement as HTMLElement;
  const row = element.querySelector<HTMLElement>('.row')!;
  const [first, second] = Array.from(row.querySelectorAll('button'));
  layOut(row, size);
  place(row, 0, size.clientWidth);
  place(first, firstButtonLeft, 100);
  place(second, 500, 100);
  await fixture.whenStable();
  return { fixture, row };
}

describe('fadeEdges', () => {
  it('names the edges that hide content', () => {
    expect(fadeEdges(0, 300, 300)).toBeNull();
    expect(fadeEdges(0, 600, 300)).toBe('end');
    expect(fadeEdges(150, 600, 300)).toBe('both');
    expect(fadeEdges(300, 600, 300)).toBe('start');
  });

  it('ignores fractions of a pixel at the edges', () => {
    expect(fadeEdges(0.5, 300.5, 300)).toBeNull();
    expect(fadeEdges(299.5, 600, 300)).toBe('start');
  });
});

describe('ScrollFade', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('marks the hidden edges as the row scrolls', async () => {
    const { row } = await render({ scrollWidth: 600, clientWidth: 300 });
    expect(row.getAttribute('data-fade')).toBe('end');

    row.scrollLeft = 150;
    row.dispatchEvent(new Event('scroll'));
    expect(row.getAttribute('data-fade')).toBe('both');

    row.scrollLeft = 300;
    row.dispatchEvent(new Event('scroll'));
    expect(row.getAttribute('data-fade')).toBe('start');
  });

  it('sets no mark when everything fits', async () => {
    const { row } = await render({ scrollWidth: 300, clientWidth: 300 });
    expect(row.hasAttribute('data-fade')).toBe(false);
  });

  it('leaves a selected item that is in view where it is', async () => {
    const { row } = await render({ scrollWidth: 600, clientWidth: 300 });
    expect(row.scrollLeft).toBe(0);
  });

  it('brings a cut-off selected item to the middle of the row', async () => {
    const { row } = await render({ scrollWidth: 800, clientWidth: 300 }, 400);
    // 400 (its left) - 0 (the row's) - (300 - 100) / 2
    expect(row.scrollLeft).toBe(300);
  });

  it('only marks the edges of a table scroller, without moving it to the selection', async () => {
    const { fixture, row } = await render({ scrollWidth: 800, clientWidth: 300 }, 400, false);
    expect(row.scrollLeft).toBe(0);
    expect(row.getAttribute('data-fade')).toBe('end');

    fixture.componentInstance.selected.set('b');
    await fixture.whenStable();
    await mutationsSettle();
    expect(row.scrollLeft).toBe(0);
  });

  it('brings the new selection into view and updates the mark when the items change', async () => {
    const size = { scrollWidth: 800, clientWidth: 300 };
    const { fixture, row } = await render(size);
    fixture.componentInstance.selected.set('b');
    await fixture.whenStable();
    await mutationsSettle();
    // 500 - 0 - (300 - 100) / 2
    expect(row.scrollLeft).toBe(400);

    size.scrollWidth = 300;
    row.scrollLeft = 0;
    fixture.componentInstance.label.set('Otra etiqueta');
    await fixture.whenStable();
    await mutationsSettle();
    expect(row.hasAttribute('data-fade')).toBe(false);
  });

  it('follows the size of the row and lets go of it when destroyed', async () => {
    const observers: { callback: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        readonly disconnect = vi.fn();
        constructor(readonly callback: () => void) {
          observers.push(this);
        }
        observe(): void {
          /* the test calls the callback itself */
        }
      },
    );
    const size = { scrollWidth: 300, clientWidth: 300 };
    const { fixture, row } = await render(size, 150);
    expect(row.hasAttribute('data-fade')).toBe(false);
    expect(row.scrollLeft).toBe(0);

    // The row narrows to 200 px: the selected item (150 to 250) is cut off and comes to the middle.
    size.clientWidth = 200;
    place(row, 0, 200);
    observers[0].callback();
    expect(row.scrollLeft).toBe(100);
    expect(row.getAttribute('data-fade')).toBe('start');

    fixture.destroy();
    expect(observers[0].disconnect).toHaveBeenCalled();
    row.scrollLeft = 0;
    row.dispatchEvent(new Event('scroll'));
    expect(row.getAttribute('data-fade')).toBe('start');
  });
});
