import { FORBIDDEN_PATH } from './catalogue';
import { sessionFile } from '../support/roles';
import {
  capture,
  combos,
  designSettings,
  DESKTOP,
  focusFirstControl,
  mainText,
  message,
  mockApiState,
  MOBILE,
  openScreen,
  screensFor,
  selectedScreens,
  test,
  viewport,
  waitForReady,
} from './support';

/**
 * Design capture (F19, D-092): every screen × role × width × theme, the empty, loading, error and forbidden states,
 * the keyboard focus of the first control and the dialogs and details of the catalogue, with axe on each view.
 * Run with `npm run design:capture` (e2e/run.sh with E2E_DESIGN=1); the output lands in e2e/design-output/<run>/.
 * A capture that cannot happen is recorded in the run's summary instead of failing the run.
 */
const settings = designSettings();
const screens = selectedScreens(settings);
const desktop = settings.widths.includes(DESKTOP) ? [DESKTOP] : settings.widths.slice(0, 1);
const pair = [...new Set([...desktop, ...(settings.widths.includes(MOBILE) ? [MOBILE] : [])])];

test.describe.configure({ mode: 'parallel' });

test('login', async ({ page, recorder }) => {
  recorder.begin('guest', 'login');
  await page.setViewportSize(viewport(DESKTOP));
  await page.goto('/login');
  await waitForReady(page, recorder);
  await capture(page, recorder, 'base', combos(settings.widths, settings.themes.slice(0, 1)), {
    axe: true,
  });
});

for (const role of settings.roles) {
  test.describe(`as ${role}`, () => {
    test.use({ storageState: sessionFile(role) });

    for (const screen of screensFor(role, screens)) {
      test(screen.id, async ({ page, recorder }) => {
        recorder.begin(role, screen.id);
        await openScreen(page, screen, recorder);
        await capture(page, recorder, 'base', combos(settings.widths, settings.themes), {
          axe: true,
        });
        if (role !== 'admin') return;

        await openScreen(page, screen, recorder);
        await capture(page, recorder, 'focus', combos(desktop, settings.themes), {
          prepare: focusFirstControl,
        });
        for (const variant of screen.variants ?? []) {
          try {
            await openScreen(page, screen, recorder);
            await variant.act(page);
            await page.waitForTimeout(500);
            await capture(page, recorder, variant.name, combos(pair, settings.themes), {
              axe: true,
              fullPage: !variant.dialog,
            });
          } catch (error) {
            recorder.problems.push(`variant ${variant.name} not captured: ${message(error)}`);
          }
        }
      });
    }

    if (role !== 'admin') {
      test('forbidden', async ({ page, recorder }) => {
        recorder.begin(role, 'forbidden');
        await page.setViewportSize(viewport(DESKTOP));
        await page.goto(FORBIDDEN_PATH[role]);
        await page.waitForURL(/\/sin-permiso$/);
        await waitForReady(page, recorder);
        await capture(page, recorder, 'base', combos(settings.widths, settings.themes), {
          axe: true,
        });
      });
    }
  });
}

if (settings.states.length && settings.roles.includes('admin')) {
  test.describe('states as admin', () => {
    test.use({ storageState: sessionFile('admin') });
    // Desktop in every theme plus mobile in the first one.
    const wanted = [
      ...combos(desktop, settings.themes),
      ...combos(
        pair.filter((width) => !desktop.includes(width)),
        settings.themes.slice(0, 1),
      ),
    ];

    for (const screen of screens) {
      for (const state of settings.states) {
        test(`${screen.id} ${state}`, async ({ page, recorder }) => {
          recorder.begin('admin', screen.id, state === 'error');
          const url = await openScreen(page, screen, recorder);
          const withData = state === 'empty' ? await mainText(page) : '';
          await mockApiState(page, state);
          await page.goto(url);
          await waitForReady(page, recorder, { loading: state === 'loading' });
          // An empty view that reads exactly like the screen with its data is not an empty state: say so.
          const notes: string[] = [];
          if (state === 'empty' && (await mainText(page)) === withData) {
            notes.push('same text as with data: nothing on this screen is emptied by the mock');
            recorder.problems.push(
              `empty state: ${screen.id} shows the same text as with its data`,
            );
          }
          await capture(page, recorder, state, wanted, { prepare: async () => notes });
        });
      }
    }
  });
}
