import { Route } from '@angular/router';
import { routes } from '../../app.routes';
import { MIN_ROLE } from '../auth/roles';
import { SECTION, SECTIONS } from './navigation';

function childRoutes(): Route[] {
  const shell = routes.find((route) => route.path === '' && route.children);
  return shell?.children ?? [];
}

describe('navigation and route table', () => {
  const children = childRoutes();

  it('has a lazy route with the same section and minimum role for every tab', () => {
    for (const section of SECTIONS) {
      for (const tab of section.tabs) {
        const route = children.find((child) => child.path === tab.path);
        expect(route, `route for ${tab.path}`).toBeDefined();
        expect(route?.loadComponent, `lazy entry for ${tab.path}`).toBeTypeOf('function');
        expect(route?.data?.[SECTION], `section of ${tab.path}`).toBe(section.id);
        expect(route?.data?.[MIN_ROLE], `role of ${tab.path}`).toBe(tab.minRole);
        expect(route?.title, `title of ${tab.path}`).toBeTruthy();
      }
    }
  });

  it('gives every screen route a section, a minimum role and a title', () => {
    const screens = children.filter((child) => child.loadComponent && child.path !== 'sin-permiso');
    for (const route of screens) {
      expect(route.data?.[SECTION], `section of ${route.path}`).toBeTruthy();
      expect(route.data?.[MIN_ROLE], `role of ${route.path}`).toBeTruthy();
      expect(route.title, `title of ${route.path}`).toBeTruthy();
    }
  });

  it('lists each path once', () => {
    const paths = SECTIONS.flatMap((section) => section.tabs.map((tab) => tab.path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('loads every entry file (placeholders and prototype screens)', async () => {
    const entries = children.filter((child) => child.loadComponent);
    for (const route of entries) {
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component, `component of ${route.path}`).toBeTypeOf('function');
    }
  });
});
