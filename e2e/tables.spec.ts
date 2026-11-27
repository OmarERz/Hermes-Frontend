import type { Locator, Page } from '@playwright/test';
import { SCREENS } from './design/catalogue';
import { asRole, expect, test } from './support/fixtures';

/**
 * Data tables (F19.5, docs/front/diseno-ronda-1.md G14), as admin against the demo data. At 1280 px every data table
 * fits its scroller (the priority columns wait for wider screens, src/styles/tables.css) and its dates take one line.
 */
const DESKTOP = { width: 1280, height: 800 };
const DENSE = [
  'vulnerabilities',
  'vulnerability-detail',
  'comparison',
  'tickets',
  'runs',
  'connections',
  'error-queue',
  'agents',
  'agents-history',
] as const;

/** Opens a screen of the design catalogue and waits for its tables to load. */
async function open(page: Page, id: string): Promise<void> {
  const screen = SCREENS.find((item) => item.id === id);
  if (!screen) throw new Error(`unknown screen ${id}`);
  await page.goto(screen.path);
  await expect(page.locator('h1').first()).toBeVisible();
  if (screen.open) await screen.open(page);
  await expect(page.getByText(/^\s*Cargando/).filter({ visible: true })).toHaveCount(0);
  await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** How far each data table overflows its scroller (0 when it fits). */
function overflows(page: Page): Promise<number[]> {
  return page
    .locator('.table-scroll:has(> .data-table)')
    .evaluateAll((scrollers) => scrollers.map((item) => item.scrollWidth - item.clientWidth));
}

/** The number of lines of each date cell's text. */
function dateLines(page: Page): Promise<number[]> {
  return page.locator('.data-table td.cell-date').evaluateAll((cells) =>
    cells
      .filter((cell) => cell.getClientRects().length > 0)
      .map((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        const tops = new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top)));
        return tops.size;
      }),
  );
}

async function expectDense(page: Page, id: string): Promise<void> {
  const scrollers = page.locator('.table-scroll:has(> .data-table)');
  expect(await scrollers.count(), `${id}: data tables`).toBeGreaterThan(0);
  for (const overflow of await overflows(page)) {
    expect(overflow, `${id}: a table wider than its scroller at 1280 px`).toBeLessThanOrEqual(1);
  }
  for (const lines of await dateLines(page)) {
    expect(lines, `${id}: a date on more than one line`).toBe(1);
  }
}

/** A table is still a table on wide screens: its header row is shown. */
async function expectTable(table: Locator): Promise<void> {
  await expect(table.locator('thead th').first()).toBeVisible();
  expect(
    await table
      .locator('tbody tr')
      .first()
      .evaluate((row) => getComputedStyle(row).display),
  ).toBe('table-row');
}

test.describe('data tables as admin', () => {
  asRole('admin');

  for (const id of DENSE) {
    test(`${id} fits its tables at 1280 px with one-line dates`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await open(page, id);
      await expectDense(page, id);
      await expectTable(page.locator('.data-table').first());
    });
  }

  test('«Todas las columnas» shows the priority columns of a table without a row detail', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, 'error-queue');
    const table = page.locator('#errors-table');
    const attempts = table.getByRole('columnheader', { name: 'Intentos' });
    await expect(attempts).toBeHidden();
    const toggle = page.getByRole('button', { name: 'Todas las columnas' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(attempts).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Próximo intento' })).toBeVisible();
    await toggle.click();
    await expect(attempts).toBeHidden();
  });

  test('the asset view of vulnerabilities fits at 1280 px too', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, 'vulnerabilities');
    await page.getByRole('button', { name: 'Por activo' }).click();
    await expect(
      page.getByRole('region', { name: 'Activos con vulnerabilidades; desplazamiento horizontal' }),
    ).toBeVisible();
    await expectDense(page, 'vulnerabilities by asset');
  });
});

/**
 * At 375 px the operation tables (Runs, Error queue, Connections and the AI reviews of the agents panel) are cards of
 * label/value pairs: the header row out of view, each field labelled, nothing to scroll sideways. Back at 1280 px,
 * the same markup is a table again.
 */
const PHONE = { width: 375, height: 812 };
const CARDS = ['runs', 'error-queue', 'connections', 'agents'] as const;

async function expectCards(page: Page, id: string): Promise<void> {
  const tables = page.locator('.data-table.cards-mobile');
  expect(await tables.count(), `${id}: card tables`).toBeGreaterThan(0);
  for (const table of await tables.all()) {
    const card = table.locator('tbody tr').first();
    await expect(card).toBeVisible();
    expect(await card.evaluate((row) => getComputedStyle(row).display), `${id}: a card`).toBe(
      'grid',
    );
    const header = await table.locator('thead').boundingBox();
    expect(header?.width ?? 0, `${id}: the header row out of view`).toBeLessThanOrEqual(1);
    const field = card.locator('td[data-label]').first();
    const label = await field.getAttribute('data-label');
    expect(
      await field.evaluate((cell) => getComputedStyle(cell, '::before').content),
      `${id}: each field shows its label`,
    ).toBe(`"${label}"`);
    const overflow = await table.evaluate(
      (element) => element.parentElement!.scrollWidth - element.parentElement!.clientWidth,
    );
    expect(overflow, `${id}: nothing to scroll sideways`).toBeLessThanOrEqual(1);
  }
}

test.describe('operation tables as admin on a phone', () => {
  asRole('admin');

  for (const id of CARDS) {
    test(`${id} shows its rows as cards at 375 px and a table at 1280 px`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await open(page, id);
      await expectCards(page, id);
      await page.setViewportSize(DESKTOP);
      await expectTable(page.locator('.data-table.cards-mobile').first());
    });
  }
});
