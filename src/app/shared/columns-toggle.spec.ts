import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColumnsToggle } from './columns-toggle';

@Component({
  imports: [ColumnsToggle],
  template: `<app-columns-toggle [(all)]="all" controls="log-table" /><app-columns-toggle
      phoneCards
    />`,
})
class Host {
  readonly all = signal(false);
}

describe('ColumnsToggle', () => {
  it('shows every column while pressed and says so with aria-pressed', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.textContent?.trim()).toBe('Todas las columnas');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('log-table');

    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.all()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.all()).toBe(false);
  });

  it('marks the toggle of a table shown as cards on phones, so the styles hide it there', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [plain, cards] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-columns-toggle'),
    );
    expect(plain.hasAttribute('data-phone-cards')).toBe(false);
    expect(cards.hasAttribute('data-phone-cards')).toBe(true);
  });
});
