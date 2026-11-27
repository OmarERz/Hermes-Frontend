import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SECTION } from '../core/navigation/navigation';
import { provideFakeSession } from '../testing/fake-session';
import { PlaceholderPage } from './placeholder-page';

describe('PlaceholderPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'formula',
            title: 'Fórmula',
            data: { [SECTION]: 'configuration' },
            component: PlaceholderPage,
          },
          { path: 'sin-datos', component: PlaceholderPage },
        ]),
        ...provideFakeSession('reader'),
      ],
    });
  });

  it('shows the route title and the pending notice', async () => {
    const harness = await RouterTestingHarness.create('/formula');
    const element = harness.routeNativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Fórmula');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'todavía no está disponible',
    );
  });

  it('falls back to the app name without a route title or section', async () => {
    const harness = await RouterTestingHarness.create('/sin-datos');
    const element = harness.routeNativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Hermes Control');
  });
});
