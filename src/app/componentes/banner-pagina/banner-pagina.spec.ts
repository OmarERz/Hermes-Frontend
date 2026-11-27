import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LucideRss } from '@lucide/angular';
import { provideFakeSession } from '../../testing/fake-session';
import { BannerPagina } from './banner-pagina';

/** jsdom lays nothing out: the description's heights say whether the fold cuts text. */
async function render(heights: { scrollHeight: number; clientHeight: number }) {
  TestBed.configureTestingModule({
    imports: [BannerPagina],
    providers: [...provideFakeSession('admin'), provideRouter([])],
  });
  const fixture = TestBed.createComponent(BannerPagina);
  fixture.componentRef.setInput('titulo', 'Fuentes');
  fixture.componentRef.setInput('descripcion', 'Fuentes que Hermes lee.');
  fixture.componentRef.setInput('icono', LucideRss);
  const element = fixture.nativeElement as HTMLElement;
  const description = element.querySelector<HTMLElement>('.heading-copy p')!;
  Object.defineProperty(description, 'scrollHeight', { get: () => heights.scrollHeight });
  Object.defineProperty(description, 'clientHeight', { get: () => heights.clientHeight });
  await fixture.whenStable();
  const toggle = () => element.querySelector<HTMLButtonElement>('.description-toggle');
  return { fixture, element, description, toggle };
}

describe('BannerPagina', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws the icon tile, the page title and its description', async () => {
    const { element, description } = await render({ scrollHeight: 52, clientHeight: 52 });
    const heading = element.querySelector('header.page-heading')!;
    expect(heading.querySelector('svg.heading-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(heading.querySelector('.heading-copy h1')?.textContent).toBe('Fuentes');
    expect(description.textContent).toBe('Fuentes que Hermes lee.');
    expect(element.querySelector('app-section-tabs')).not.toBeNull();
  });

  it('folds the description and offers no toggle when nothing is cut', async () => {
    const { description, toggle } = await render({ scrollHeight: 52, clientHeight: 52 });
    expect(description.classList).toContain('folded');
    expect(toggle()).toBeNull();
  });

  it('unfolds and folds again a description that the fold cuts', async () => {
    const { fixture, description, toggle } = await render({ scrollHeight: 78, clientHeight: 52 });
    expect(toggle()?.textContent?.trim()).toBe('Ver más');
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle()?.getAttribute('aria-controls')).toBe(description.id);

    toggle()!.click();
    await fixture.whenStable();
    expect(description.classList).not.toContain('folded');
    expect(toggle()?.textContent?.trim()).toBe('Ver menos');
    expect(toggle()?.getAttribute('aria-expanded')).toBe('true');

    toggle()!.click();
    await fixture.whenStable();
    expect(description.classList).toContain('folded');
    expect(toggle()?.textContent?.trim()).toBe('Ver más');
  });

  it('measures again when its width changes, and not while unfolded', async () => {
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
    const heights = { scrollHeight: 52, clientHeight: 52 };
    const { fixture, toggle } = await render(heights);
    expect(toggle()).toBeNull();

    // Narrower: the same text needs a third line.
    heights.scrollHeight = 78;
    observers[0].callback();
    await fixture.whenStable();
    expect(toggle()?.textContent?.trim()).toBe('Ver más');

    toggle()!.click();
    await fixture.whenStable();
    heights.scrollHeight = 52;
    observers[0].callback();
    await fixture.whenStable();
    expect(toggle()?.textContent?.trim()).toBe('Ver menos');

    fixture.destroy();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });
});
