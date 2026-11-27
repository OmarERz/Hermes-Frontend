import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Role } from '../../core/api/api-types';
import { provideFakeSession } from '../../testing/fake-session';
import { ForbiddenPage } from './forbidden-page';

describe('ForbiddenPage', () => {
  async function render(role: Role | null): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...provideFakeSession(role)] });
    const fixture = TestBed.createComponent(ForbiddenPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('names the effective role and links back home', async () => {
    const element = await render('reader');
    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No tienes permiso para ver esta sección');
    expect(alert?.querySelector('strong')?.textContent).toBe('Lector');
    expect(alert?.querySelector('a')?.getAttribute('href')).toBe('/inicio');
    // Said once (SIN-1): the banner gives the reason, the card the role and the way back, as a button.
    expect(element.querySelector('app-banner-pagina')?.textContent).not.toContain(
      'No tienes permiso',
    );
    expect(alert?.querySelector('a')?.classList).toContain('btn-primary');
  });

  it('says so when there is no role', async () => {
    const element = await render(null);
    expect(element.querySelector('strong')?.textContent).toBe('sin rol');
  });
});
