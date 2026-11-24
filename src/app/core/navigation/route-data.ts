/**
 * Route data keys, kept apart from the navigation model so the eager route table does not pull the icon set into
 * the initial bundle.
 */
export const SECTION = 'section';

/** Sections of the sidebar; each route declares its section in `data.section`. */
export type SectionId =
  'home' | 'agents' | 'vulnerabilities' | 'inventory' | 'configuration' | 'operations';
