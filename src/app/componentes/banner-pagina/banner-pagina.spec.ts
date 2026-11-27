import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LucideRss } from '@lucide/angular';
import { provideFakeSession } from '../../testing/fake-session';
import { BannerPagina } from './banner-pagina';

describe('BannerPagina', () => {
  it('draws the icon tile, the page title and its description', async () => {
    TestBed.configureTestingModule({
      imports: [BannerPagina],
      providers: [...provideFakeSession('admin'), provideRouter([])],
    });
    const fixture = TestBed.createComponent(BannerPagina);
    fixture.componentRef.setInput('titulo', 'Fuentes');
    fixture.componentRef.setInput('descripcion', 'Fuentes que Hermes lee.');
    fixture.componentRef.setInput('icono', LucideRss);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const heading = element.querySelector('header.page-heading')!;
    expect(heading.querySelector('svg.heading-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(heading.querySelector('.heading-copy h1')?.textContent).toBe('Fuentes');
    expect(heading.querySelector('.heading-copy p')?.textContent).toBe('Fuentes que Hermes lee.');
    expect(element.querySelector('app-section-tabs')).not.toBeNull();
  });
});
