import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

/**
 * Colour theme of the app shell (data-theme of .app-shell, read by the styles and the charts). Switched from the
 * profile menu; not persisted, so every load starts dark, as the prototype did.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly current = signal<Theme>('dark');

  readonly theme = this.current.asReadonly();

  toggle(): void {
    this.current.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
  }
}
