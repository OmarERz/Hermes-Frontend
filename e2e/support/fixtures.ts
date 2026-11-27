import { test as base, expect, type Page } from '@playwright/test';
import { sessionFile, type Role } from './roles';

export { expect } from '@playwright/test';

/**
 * The suite's `test`: every test fails if the page throws an uncaught error or the browser blocks anything by the
 * Content-Security-Policy of the front container: every `securitypolicyviolation` event of every page the test opens
 * (inline styles and attributes included), and the CSP errors the console reports.
 */
export const test = base.extend<{ pageProblems: string[] }>({
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`uncaught error: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error' && /Content[- ]Security[- ]Policy/i.test(message.text())) {
          problems.push(`CSP violation: ${message.text()}`);
        }
      });
      await page.exposeFunction('hermesReportCspViolation', (text: string) =>
        problems.push(`CSP violation: ${text}`),
      );
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          const report = (window as unknown as { hermesReportCspViolation(text: string): void })
            .hermesReportCspViolation;
          void report(
            `${event.effectiveDirective} blocked ${event.blockedURI || 'inline'} ` +
              `(${event.sourceFile || 'page'}:${event.lineNumber}) ${event.sample}`,
          );
        });
      });
      await use(problems);
      expect(problems, 'uncaught errors or CSP violations in the page').toEqual([]);
    },
    { auto: true },
  ],
});

/** Runs the tests of the enclosing describe signed in as `role` (session saved by login.setup.ts). */
export function asRole(role: Role): void {
  test.use({ storageState: sessionFile(role) });
}

/** Opens a screen and checks it rendered: its document title, its main heading and that it kept its path. */
export async function expectScreen(page: Page, path: string, title: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveTitle(`${title} · Hermes Control`);
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(path)}$`));
  await expect(page.locator('h1').first()).toBeVisible();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Gives the page a moment to report what it already did (CSP violation events reach the test asynchronously). */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 250)));
}
