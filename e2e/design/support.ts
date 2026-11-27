import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { canOpen, SCREENS, type Screen } from './catalogue';
import { outputRoot, ROLES, type Role } from '../support/roles';

export type Theme = 'dark' | 'light';
/** Screens without the app shell (the login) have no theme switch. */
export type ShotTheme = Theme | 'none';
export type StateName = 'empty' | 'loading' | 'error';
export type Who = Role | 'guest';

const WIDTHS = [375, 768, 1280, 1920];
const THEMES: readonly Theme[] = ['dark', 'light'];
const STATES: readonly StateName[] = ['empty', 'loading', 'error'];
/** Width of the axe runs and of the views captured at a single desktop width. */
export const DESKTOP = 1280;
export const MOBILE = 375;

/** WCAG 2.2 A/AA plus axe's best practices; the summary keeps both apart. */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

export interface DesignSettings {
  roles: Role[];
  widths: number[];
  themes: Theme[];
  states: StateName[];
  /** Screen ids to capture (E2E_DESIGN_SCREENS); all when empty. */
  screens: string[];
  /** Also capture the screens still marked pending (E2E_DESIGN_PENDING=1). */
  pending: boolean;
}

function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function pick<T extends string>(name: string, allowed: readonly T[]): T[] {
  const values = list(name);
  if (!values.length) return [...allowed];
  if (values.length === 1 && values[0] === 'none') return [];
  const unknown = values.filter((value) => !allowed.includes(value as T));
  if (unknown.length) throw new Error(`${name}: unknown ${unknown.join(', ')}`);
  return values as T[];
}

/** What to capture, from the E2E_DESIGN_* variables (defaults: every role, width, theme and state). */
export function designSettings(): DesignSettings {
  const widths = list('E2E_DESIGN_WIDTHS').map(Number);
  if (widths.some((width) => !Number.isInteger(width) || width < 320 || width > 3840)) {
    throw new Error('E2E_DESIGN_WIDTHS: widths are integers between 320 and 3840');
  }
  return {
    roles: pick('E2E_DESIGN_ROLES', ROLES),
    widths: widths.length ? widths : WIDTHS,
    themes: pick('E2E_DESIGN_THEMES', THEMES),
    states: pick('E2E_DESIGN_STATES', STATES),
    screens: list('E2E_DESIGN_SCREENS'),
    pending: process.env['E2E_DESIGN_PENDING'] === '1',
  };
}

export function selectedScreens(settings: DesignSettings): Screen[] {
  const unknown = settings.screens.filter((id) => !SCREENS.some((screen) => screen.id === id));
  if (unknown.length) throw new Error(`E2E_DESIGN_SCREENS: unknown ${unknown.join(', ')}`);
  return SCREENS.filter(
    (screen) =>
      (settings.pending || !screen.pending) &&
      (!settings.screens.length || settings.screens.includes(screen.id)),
  );
}

export function screensFor(role: Role, screens: Screen[]): Screen[] {
  return screens.filter((screen) => canOpen(role, screen));
}

/**
 * This run's capture folder: e2e/design-output/<run>/ (ignored by git), named like the run's e2e/test-output/
 * folder. Unlike that one, e2e/run.sh never prunes it.
 */
export function designRoot(): string {
  return resolve(
    process.env['E2E_DESIGN_OUTPUT_DIR'] ?? join('e2e', 'design-output', basename(outputRoot())),
  );
}

export function viewport(width: number): { width: number; height: number } {
  const heights: Record<number, number> = { 375: 812, 768: 1024, 1280: 800, 1920: 1080 };
  return { width, height: heights[width] ?? Math.round(width * 0.625) };
}

export interface ShotRecord {
  /** Relative to the capture folder. */
  file: string;
  who: Who;
  screen: string;
  view: string;
  width: number;
  theme: ShotTheme;
  /** How far the page scrolls sideways (0 = no horizontal scroll). */
  overflowPx: number;
  /** Outermost elements of <main> past the right edge that no scroll container holds (cut off or scrolling). */
  offenders: string[];
  notes: string[];
}

export interface AxeViolation {
  id: string;
  impact: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: number;
}

export interface AxeRecord {
  file: string;
  who: Who;
  screen: string;
  view: string;
  theme: ShotTheme;
  width: number;
  violations: AxeViolation[];
  /** Rules axe could not decide (e.g. contrast over gradients): to check by eye. */
  incomplete: { id: string; nodes: number }[];
}

export interface TestRecord {
  title: string;
  who: Who;
  screen: string;
  status: string;
  error?: string;
  shots: ShotRecord[];
  axe: AxeRecord[];
  problems: string[];
}

/** Collects what one test captured; saved as meta/<test>.json for the report (report.ts). */
export class Recorder {
  who: Who = 'guest';
  screen = '';
  /** API errors are the point of the error state: not reported as problems there. */
  expectErrors = false;
  readonly shots: ShotRecord[] = [];
  readonly axe: AxeRecord[] = [];
  readonly problems: string[] = [];

  begin(who: Who, screen: string, expectErrors = false): void {
    this.who = who;
    this.screen = screen;
    this.expectErrors = expectErrors;
  }

  save(info: TestInfo): void {
    const record: TestRecord = {
      title: info.titlePath.slice(1).join(' › '),
      who: this.who,
      screen: this.screen,
      status: info.status ?? 'unknown',
      error: info.error?.message?.split('\n')[0],
      shots: this.shots,
      axe: this.axe,
      problems: [...new Set(this.problems)],
    };
    const file = join(designRoot(), 'meta', `${info.testId}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(record, null, 2));
  }
}

function isApi(url: URL): boolean {
  return url.pathname.startsWith('/api/');
}

/**
 * The capture's `test`: every test records (instead of failing on) uncaught errors, CSP violations and API errors
 * of its pages, and saves what it captured even when it fails.
 */
export const test = base.extend<{ recorder: Recorder }>({
  recorder: [
    async ({ page }, use, info) => {
      const recorder = new Recorder();
      page.on('pageerror', (error) => recorder.problems.push(`uncaught error: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error' && /Content[- ]Security[- ]Policy/i.test(message.text())) {
          recorder.problems.push(`CSP violation: ${message.text()}`);
        }
      });
      page.on('response', (response) => {
        const url = new URL(response.url());
        if (isApi(url) && response.status() >= 400 && !recorder.expectErrors) {
          recorder.problems.push(`API ${response.status()} ${url.pathname}`);
        }
      });
      await use(recorder);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      recorder.save(info);
    },
    { auto: true },
  ],
});

export function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';
}

/**
 * Waits until the screen drew its content: a visible h1, no visible «Cargando…» (unless that is the state being
 * captured), the fonts, and a moment for the charts. Records what never happened instead of failing.
 */
export async function waitForReady(
  page: Page,
  recorder: Recorder,
  options: { loading?: boolean } = {},
): Promise<void> {
  try {
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    recorder.problems.push(`${page.url()}: no visible h1 after 20 s`);
  }
  if (!options.loading) {
    try {
      await expect(page.getByText(/^\s*Cargando/).filter({ visible: true })).toHaveCount(0, {
        timeout: 20_000,
      });
    } catch {
      recorder.problems.push(`${page.url()}: still shows «Cargando…» after 20 s`);
    }
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(700);
}

/** Opens a screen (and its detail, if it has one); returns the URL it ended on. */
export async function openScreen(page: Page, screen: Screen, recorder: Recorder): Promise<string> {
  await page.setViewportSize(viewport(DESKTOP));
  await page.goto(screen.path);
  await waitForReady(page, recorder);
  if (screen.open) {
    await screen.open(page);
    await waitForReady(page, recorder);
  }
  return page.url();
}

/** Sets the theme with the switch of the app shell (not persisted: every load starts dark). */
async function setTheme(page: Page, theme: Theme): Promise<boolean> {
  const shell = page.locator('.app-shell');
  if (!(await shell.count())) return false;
  if ((await shell.getAttribute('data-theme')) !== theme) {
    // A dispatched click: the pointer never hovers anything in the captures.
    await page.locator('.theme-toggle').dispatchEvent('click');
    await expect(shell).toHaveAttribute('data-theme', theme);
    await page.waitForTimeout(300);
  }
  return true;
}

async function resize(page: Page, width: number): Promise<void> {
  const size = viewport(width);
  const current = page.viewportSize();
  if (current?.width === size.width && current.height === size.height) return;
  await page.setViewportSize(size);
  await page.waitForTimeout(500);
}

/**
 * How far the page scrolls sideways, and the outermost elements past the right edge that no horizontal scroller
 * holds: «cut off» when an ancestor clips them (the content is lost), otherwise they widen the page; «hidden» when
 * they are not visible (they still widen it). An absolutely positioned element escapes the scrollers between it and
 * its containing block (a tooltip inside a scrolling table widens the page), a fixed one escapes all of them.
 */
async function measureOverflow(page: Page): Promise<{ overflowPx: number; offenders: string[] }> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const edge = root.clientWidth + 1;
    const name = (element: Element): string => {
      const classes = [...element.classList].slice(0, 2).join('.');
      return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${classes ? `.${classes}` : ''}`;
    };
    const containingBlock = (element: Element): Element | null => {
      const position = getComputedStyle(element).position;
      if (position === 'fixed') return null;
      if (position !== 'absolute') return element.parentElement;
      for (let up = element.parentElement; up; up = up.parentElement) {
        const style = getComputedStyle(up);
        if (style.position !== 'static' || style.transform !== 'none') return up;
      }
      return root;
    };
    /** The overflow of `up` applies to `element` (it clips or scrolls it). */
    const governs = (up: Element, block: Element | null): boolean => !!block && up.contains(block);
    const memo = new Map<Element, boolean>();
    const escapes = (element: Element): boolean => {
      const known = memo.get(element);
      if (known !== undefined) return known;
      const box = element.getBoundingClientRect();
      let result = box.width > 0 && box.right > edge;
      if (result) {
        const block = containingBlock(element);
        for (let up = element.parentElement; up && up !== document.body; up = up.parentElement) {
          const overflow = getComputedStyle(up).overflowX;
          if ((overflow === 'auto' || overflow === 'scroll') && governs(up, block)) {
            result = false;
            break;
          }
        }
      }
      memo.set(element, result);
      return result;
    };
    const offenders: string[] = [];
    for (const element of document.body.querySelectorAll('*')) {
      if (!escapes(element)) continue;
      let outermost = true;
      let clipped = false;
      const block = containingBlock(element);
      for (let up = element.parentElement; up && up !== document.body; up = up.parentElement) {
        if (escapes(up)) {
          outermost = false;
          break;
        }
        const overflow = getComputedStyle(up).overflowX;
        if ((overflow === 'hidden' || overflow === 'clip') && governs(up, block)) clipped = true;
      }
      if (!outermost) continue;
      const style = getComputedStyle(element);
      const hidden = style.visibility === 'hidden' || style.opacity === '0';
      const past = Math.round(element.getBoundingClientRect().right - root.clientWidth);
      const marks = [clipped ? 'cut off' : '', hidden ? 'hidden' : ''].filter(Boolean).join(', ');
      offenders.push(`${name(element)} +${past}px${marks ? ` (${marks})` : ''}`);
      if (offenders.length >= 8) break;
    }
    return { overflowPx: Math.max(0, root.scrollWidth - root.clientWidth), offenders };
  });
}

/**
 * On phones the bottom navigation is fixed to the viewport, so a full-page capture would draw it in the middle of the
 * page: while the screenshot is taken it is moved to the end of the page, into the space the shell reserves for it
 * (padding-bottom of .app-shell). Inline styles through the CSSOM, because the app's CSP blocks injected stylesheets
 * (also the `style` option of page.screenshot).
 */
async function pinFixedBar(page: Page, pin: boolean): Promise<void> {
  await page.evaluate((pinned) => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const bar = shell?.querySelector<HTMLElement>('.sidebar');
    if (!shell || !bar) return;
    if (!pinned) {
      shell.style.removeProperty('position');
      bar.style.removeProperty('position');
    } else if (getComputedStyle(bar).position === 'fixed') {
      shell.style.setProperty('position', 'relative');
      bar.style.setProperty('position', 'absolute', 'important');
    }
  }, pin);
}

export interface Combo {
  width: number;
  theme: Theme;
}

export function combos(widths: number[], themes: Theme[]): Combo[] {
  return themes.flatMap((theme) => widths.map((width) => ({ width, theme })));
}

/**
 * Captures the current view at each width and theme (full page unless `fullPage: false`, animations stopped) and,
 * if asked, runs axe once
 * per theme at the desktop width. Screens without the app shell are captured once per width with theme "none".
 */
export async function capture(
  page: Page,
  recorder: Recorder,
  view: string,
  wanted: Combo[],
  options: { axe?: boolean; fullPage?: boolean; notes?: (page: Page) => Promise<string[]> } = {},
): Promise<void> {
  const themes = [...new Set(wanted.map((combo) => combo.theme))];
  for (const theme of themes) {
    await resize(page, DESKTOP);
    const themed = await setTheme(page, theme);
    const shotTheme: ShotTheme = themed ? theme : 'none';
    for (const { width } of wanted.filter((combo) => combo.theme === theme)) {
      await resize(page, width);
      const file = join(
        'shots',
        recorder.who,
        recorder.screen,
        `${view}-${width}-${shotTheme}.png`,
      );
      const fullPage = options.fullPage ?? true;
      if (fullPage) await pinFixedBar(page, true);
      await page.screenshot({ path: join(designRoot(), file), fullPage, animations: 'disabled' });
      if (fullPage) await pinFixedBar(page, false);
      recorder.shots.push({
        file,
        who: recorder.who,
        screen: recorder.screen,
        view,
        width,
        theme: shotTheme,
        ...(await measureOverflow(page)),
        notes: options.notes ? await options.notes(page) : [],
      });
    }
    if (options.axe) {
      await resize(page, DESKTOP);
      await runAxe(page, recorder, view, shotTheme);
    }
    if (!themed) break;
  }
}

async function runAxe(
  page: Page,
  recorder: Recorder,
  view: string,
  theme: ShotTheme,
): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const file = join('axe', recorder.who, recorder.screen, `${view}-${theme}.json`);
  const violations = result.violations.map((rule) => ({
    id: rule.id,
    impact: rule.impact ?? 'unknown',
    help: rule.help,
    helpUrl: rule.helpUrl,
    tags: rule.tags,
    nodes: rule.nodes.map((node) => ({
      target: node.target,
      html: node.html.slice(0, 300),
      summary: node.failureSummary,
    })),
  }));
  const path = join(designRoot(), file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ url: result.url, violations }, null, 2));
  recorder.axe.push({
    file,
    who: recorder.who,
    screen: recorder.screen,
    view,
    theme,
    width: DESKTOP,
    violations: violations.map(({ nodes, ...rule }) => ({ ...rule, nodes: nodes.length })),
    incomplete: result.incomplete.map((rule) => ({ id: rule.id, nodes: rule.nodes.length })),
  });
}

/**
 * Focuses the first control of <main> outside the section tabs (a button, field or link) as a keyboard user would,
 * so its :focus-visible style shows; notes whether it draws a visible indicator.
 */
export async function focusFirstControl(page: Page): Promise<string[]> {
  const controls = page.locator(
    'main :is(button, input, select, textarea, a[href]):not(:disabled, [tabindex="-1"])',
  );
  const index = await controls.evaluateAll((elements) =>
    elements.findIndex((element) => !element.closest('nav') && element.getClientRects().length > 0),
  );
  if (index < 0) return ['no visible control in main'];
  await page.keyboard.press('Tab');
  await controls.nth(index).focus();
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return ['nothing focused'];
    const style = getComputedStyle(active);
    const ring =
      (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
      style.boxShadow !== 'none';
    const label =
      active.getAttribute('aria-label') ?? active.textContent?.trim().slice(0, 40) ?? '';
    const indicator = ring
      ? `indicator ${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`
      : 'NO visible focus indicator';
    return [`focused <${active.tagName.toLowerCase()}> «${label}»: ${indicator}`];
  });
}

/** The error envelope of the API (FRONTEND.md §4) with the backend's generic 500 message. */
const SERVER_ERROR = {
  error: {
    code: 'internal_error',
    message: 'Ocurrió un error en el servidor. Intenta de nuevo más tarde.',
  },
};

/** Kept real in every state: the session's role and the configuration schema that draws the forms. */
const ALWAYS_REAL = new Set(['/api/me', '/api/config/schema']);

function emptied(body: unknown): unknown {
  if (Array.isArray(body)) return [];
  if (body && typeof body === 'object') {
    return Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, Array.isArray(value) ? [] : value]),
    );
  }
  return body;
}

/**
 * Mocks the API reads of the page for a state: `loading` never answers them, `error` answers the API's 500 and
 * `empty` answers the real response with every top-level list emptied. Writes are never touched.
 */
export async function mockApiState(page: Page, state: StateName): Promise<void> {
  await page.route(
    (url) => isApi(url) && !ALWAYS_REAL.has(url.pathname),
    async (route) => {
      const request = route.request();
      if (request.method() !== 'GET') return route.fallback();
      if (state === 'loading') return; // never answered: the screen stays loading
      if (state === 'error') {
        return route.fulfill({ status: 500, json: SERVER_ERROR });
      }
      // A live stream (server-sent events) never ends: left alone.
      if (new URL(request.url()).pathname.endsWith('/events')) return route.fallback();
      const response = await route.fetch();
      if (!(response.headers()['content-type'] ?? '').includes('application/json')) {
        return route.fulfill({ response });
      }
      return route.fulfill({ response, json: emptied(await response.json()) });
    },
  );
}
