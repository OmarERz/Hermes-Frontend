import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Input,
  signal,
  viewChild,
} from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { SectionTabs } from '../../shared/section-tabs';

let nextId = 0;

/**
 * Page banner of every screen but the home: icon tile, title (the page's h1) and description, then the tabs of the
 * section. It carries its own spacing (--section-gap to the tabs and to the content). The description folds to two
 * lines (three on phones, docs/front/diseno-ronda-1.md G6 and G13); when that cuts text, «Ver más» shows it all.
 */
@Component({
  selector: 'app-banner-pagina',
  imports: [LucideDynamicIcon, SectionTabs],
  templateUrl: './banner-pagina.html',
  styleUrl: './banner-pagina.css',
})
export class BannerPagina {
  @Input({ required: true }) titulo = '';
  @Input({ required: true }) descripcion = '';
  @Input({ required: true }) icono!: LucideIconInput;
  /**
   * VDE-5 (F19.8): an identifier the title starts with (a CVE) that never breaks across lines; the rest of the title
   * wraps as usual. The title's text stays the same.
   */
  @Input() codigo = '';

  get tituloResto(): string | null {
    return this.codigo && this.titulo.startsWith(this.codigo)
      ? this.titulo.slice(this.codigo.length)
      : null;
  }

  readonly descriptionId = `page-description-${nextId++}`;
  /** The person unfolded the description. */
  readonly expanded = signal(false);
  /** The folded description hides part of its text. */
  readonly clipped = signal(false);

  private readonly description = viewChild.required<ElementRef<HTMLElement>>('description');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.description().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  toggle(): void {
    this.expanded.update((expanded) => !expanded);
  }

  /** Whether the folded description cuts text; measured only while it is folded. */
  measure(): void {
    if (this.expanded()) return;
    const element = this.description().nativeElement;
    this.clipped.set(element.scrollHeight > element.clientHeight + 1);
  }
}
