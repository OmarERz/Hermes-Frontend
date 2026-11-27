import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ThemeService } from '../../core/theme/theme.service';
import { provideFakeSession } from '../../testing/fake-session';
import { LayoutPrincipal } from './layout-principal';

describe('LayoutPrincipal', () => {
  it('draws the theme of ThemeService and has no floating theme button', async () => {
    TestBed.configureTestingModule({
      imports: [LayoutPrincipal],
      providers: [...provideFakeSession('admin'), provideRouter([])],
    });
    const fixture = TestBed.createComponent(LayoutPrincipal);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const shell = element.querySelector('.app-shell')!;
    expect(shell.getAttribute('data-theme')).toBe('dark');
    expect(element.querySelector('.workspace .theme-toggle')).toBeNull();

    TestBed.inject(ThemeService).toggle();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(shell.getAttribute('data-theme')).toBe('light');
  });
});
