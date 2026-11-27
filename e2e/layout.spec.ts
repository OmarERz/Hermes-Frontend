import type { Page } from '@playwright/test';
import { canOpen, SCREENS } from './design/catalogue';
import { asRole, expect, test } from './support/fixtures';

/**
 * No horizontal scroll of the page (F19 acceptance, docs/front/diseno-ronda-1.md G13): every built screen of the
 * design catalogue, as admin, at 375 px (the criterion), then at 768 and 1280 px. A wide table scrolls inside its own
 * scroller; the page itself never scrolls sideways.
 */
const WIDTHS = [375, 768, 1280] as const;
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

test.describe('layout as admin', () => {
  asRole('admin');

  for (const screen of screens) {
    test(`${screen.id} never scrolls the page sideways`, async ({ page }) => {
      await page.setViewportSize({ width: WIDTHS[0], height: HEIGHT });
      await page.goto(screen.path);
      await expect(page.locator('h1').first()).toBeVisible();
      if (screen.open) await screen.open(page);
      await expect(page.getByText(/^\s*Cargando/).filter({ visible: true })).toHaveCount(0);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: HEIGHT });
        expect(await sideways(page), `${screen.id} at ${width} px`).toBe(0);
      }
    });
  }
});
