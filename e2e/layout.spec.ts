import type { Page } from '@playwright/test';
import { canOpen, SCREENS } from './design/catalogue';
import { checkLayout } from './support/layout-checks';
import { asRole, expect, test } from './support/fixtures';

/**
 * Layout guards of every built screen of the design catalogue, as admin:
 * - no horizontal scroll of the page (F19 acceptance, docs/front/diseno-ronda-1.md G13) at 375 px (the criterion),
 *   768 and 1280 px: a wide table scrolls inside its own scroller, the page itself never scrolls sideways;
 * - at 375 and 1280 px, no edge that ends inside another box (F19.8, D-108: a panel shorter than its column, a column
 *   divider shorter than its card, a card narrower than the one stacked on it; e2e/support/layout-checks.ts), and the
 *   navigation in place: the sidebar fills the viewport's height at any scroll and its column is painted to the end of
 *   the page; on phones the bottom bar sits on the viewport's bottom edge, full width.
 */
const WIDTHS = [375, 768, 1280] as const;
const GUARDED: readonly number[] = [375, 1280];
const PHONE = 560;
const HEIGHT = 812;
const screens = SCREENS.filter((screen) => !screen.pending && canOpen('admin', screen));

/** How far the page scrolls sideways, once the layout settled (fonts, charts and their resize guard). */
async function sideways(page: Page): Promise<number> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(400);
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

interface Navigation {
  /** The sidebar (or bottom bar) at the end of the page, in viewport coordinates. */
  top: number;
  bottom: number;
  left: number;
  width: number;
  viewportHeight: number;
  viewportWidth: number;
  /** Where the painted navigation column ends and where the page ends (document coordinates). */
  columnBottom: number;
  pageBottom: number;
}

/** Scrolls to the end of the page, measures the navigation and scrolls back. */
async function navigationAtTheEnd(page: Page): Promise<Navigation> {
  const result = await page.evaluate(async () => {
    const bar = document.querySelector('.app-shell .sidebar');
    if (!bar) throw new Error('no .sidebar in the shell');
    const pageBottom = document.documentElement.scrollHeight;
    window.scrollTo(0, pageBottom);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = bar.getBoundingClientRect();
    const painted = (element: Element): boolean => {
      const style = getComputedStyle(element);
      return (
        style.backgroundImage !== 'none' ||
        !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor)
      );
    };
    let columnBottom = rect.bottom + scrollY;
    for (
      let up = bar.parentElement;
      up && !up.classList.contains('app-shell');
      up = up.parentElement
    ) {
      if (painted(up))
        columnBottom = Math.max(columnBottom, up.getBoundingClientRect().bottom + scrollY);
    }
    const measured = {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      viewportHeight: innerHeight,
      viewportWidth: document.documentElement.clientWidth,
      columnBottom,
      pageBottom,
    };
    window.scrollTo(0, 0);
    return measured;
  });
  await page.waitForTimeout(100);
  return result;
}

async function expectNavigationInPlace(page: Page, id: string, width: number): Promise<void> {
  const nav = await navigationAtTheEnd(page);
  const where = `${id} at ${width} px`;
  if (width <= PHONE) {
    expect(
      Math.abs(nav.bottom - nav.viewportHeight),
      `${where}: bottom bar on the viewport's edge`,
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(nav.left), `${where}: bottom bar from the left edge`).toBeLessThanOrEqual(1);
    expect(
      Math.abs(nav.width - nav.viewportWidth),
      `${where}: bottom bar full width`,
    ).toBeLessThanOrEqual(1);
    return;
  }
  expect(
    Math.abs(nav.top),
    `${where}: sidebar at the top of the viewport at the end of the page`,
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(nav.bottom - nav.viewportHeight),
    `${where}: sidebar as tall as the viewport at the end of the page`,
  ).toBeLessThanOrEqual(1);
  expect(
    nav.columnBottom,
    `${where}: sidebar column painted to the end of the page`,
  ).toBeGreaterThanOrEqual(nav.pageBottom - 1);
}

test.describe('layout as admin', () => {
  asRole('admin');

  for (const screen of screens) {
    test(`${screen.id} never scrolls sideways and keeps its edges in line`, async ({ page }) => {
      await page.setViewportSize({ width: WIDTHS[0], height: HEIGHT });
      await page.goto(screen.path);
      await expect(page.locator('h1').first()).toBeVisible();
      if (screen.open) await screen.open(page);
      await expect(page.getByText(/^\s*Cargando/).filter({ visible: true })).toHaveCount(0);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: HEIGHT });
        expect(await sideways(page), `${screen.id} at ${width} px`).toBe(0);
        if (!GUARDED.includes(width)) continue;
        const { findings } = await checkLayout(page, { kinds: ['edge'], pieces: false });
        expect(
          findings.map((finding) => `${finding.rule} · ${finding.element} · ${finding.detail}`),
          `${screen.id} at ${width} px: edges that end inside another box`,
        ).toEqual([]);
        await expectNavigationInPlace(page, screen.id, width);
      }
    });
  }
});
