import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Role } from '../api/api-types';
import { SessionService } from '../auth/session.service';
import { SectionTabs } from '../../shared/section-tabs';
import { ActiveSection } from './active-section.service';
import { SECTION } from './navigation';

@Component({ template: '' })
class Blank {}

describe('ActiveSection and SectionTabs', () => {
  const role = signal<Role | null>('reader');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SectionTabs],
      providers: [
        provideRouter([
          { path: 'vulnerabilidades', component: Blank, data: { [SECTION]: 'vulnerabilities' } },
          { path: 'usuarios', component: Blank, data: { [SECTION]: 'operations' } },
          { path: 'inicio', component: Blank, data: { [SECTION]: 'home' } },
        ]),
        { provide: SessionService, useValue: { role } },
      ],
    });
  });

  it('follows the section of the current route and hides tabs above the role', async () => {
    role.set('reader');
    const navigation = TestBed.inject(ActiveSection);
    await TestBed.inject(Router).navigateByUrl('/vulnerabilidades');
    expect(navigation.current()?.id).toBe('vulnerabilities');
    expect(navigation.tabs().map((tab) => tab.path)).toEqual([
      'vulnerabilidades',
      'comparacion',
      'tickets',
    ]);
    role.set('analyst');
    expect(navigation.tabs().map((tab) => tab.path)).toContain('exportacion-stix');
  });

  it('links each sidebar section to the first tab the role can open', () => {
    role.set('reader');
    const operations = TestBed.inject(ActiveSection)
      .sections()
      .find((section) => section.id === 'operations');
    expect(operations?.link).toBe('/corridas');
    role.set(null);
    expect(TestBed.inject(ActiveSection).sections()).toEqual([]);
  });

  it('renders the tabs under the banner only when the section has more than one', async () => {
    role.set('admin');
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/usuarios');
    const fixture = TestBed.createComponent(SectionTabs);
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map(
      (a) => a.textContent?.trim(),
    );
    expect(links).toEqual([
      'Corridas',
      'Usuarios',
      'Conexiones',
      'Auditoría',
      'Cola de errores',
      'Asistente',
    ]);

    await router.navigateByUrl('/inicio');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).toBeNull();
  });
});
