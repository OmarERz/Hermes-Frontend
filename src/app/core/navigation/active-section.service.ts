import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { roleAtLeast } from '../auth/roles';
import { SessionService } from '../auth/session.service';
import { findSection, NavSection, NavTab, SECTION, SECTIONS } from './navigation';

function deepest(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let route = snapshot;
  while (route.firstChild) route = route.firstChild;
  return route;
}

/** The section of the current route (`data.section`) and the tabs and sections the role can open. */
@Injectable({ providedIn: 'root' })
export class ActiveSection {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  private readonly sectionId = signal<unknown>(this.read());

  readonly current = computed<NavSection | null>(() => findSection(this.sectionId()));

  /** Tabs of the current section that the effective role can open. */
  readonly tabs = computed<NavTab[]>(() => this.allowedTabs(this.current()));

  /** Sidebar entries: sections with at least one tab the role can open, linking to the first one. */
  readonly sections = computed(() =>
    SECTIONS.map((section) => ({ section, tabs: this.allowedTabs(section) }))
      .filter(({ tabs }) => tabs.length > 0)
      .map(({ section, tabs }) => ({ ...section, link: `/${tabs[0].path}` })),
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.sectionId.set(this.read()));
  }

  private allowedTabs(section: NavSection | null): NavTab[] {
    if (!section) return [];
    const role = this.session.role();
    return section.tabs.filter((tab) => roleAtLeast(role, tab.minRole));
  }

  private read(): unknown {
    return deepest(this.router.routerState.snapshot.root).data[SECTION];
  }
}
