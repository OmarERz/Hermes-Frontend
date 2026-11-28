import type { Page } from '@playwright/test';
import { checkLayout, type LayoutFinding } from './support/layout-checks';
import { expect, test } from './support/fixtures';

/**
 * The alignment checks themselves (e2e/support/layout-checks.ts) on small pages written here, so a check that stops
 * seeing a defect fails on its own, not only when a screen regresses. No backend and no session needed.
 */
const BASE = `
  body { margin: 0; font: 16px/1.4 sans-serif; }
  .app-shell { display: grid; grid-template-columns: 200px 1fr; min-height: 100vh; }
  .page-content { padding: 24px; }
  .card { background: #eee; border-radius: 16px; padding: 20px; }
`;

async function render(page: Page, css: string, body: string): Promise<LayoutFinding[]> {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.setContent(`<!doctype html><style>${BASE}${css}</style>${body}`);
  return (await checkLayout(page, { pieces: false })).findings;
}

const rules = (findings: LayoutFinding[]): string[] =>
  findings.map((finding) => `${finding.kind}:${finding.rule}`);

test.describe('layout checks', () => {
  test('a clean page has no findings', async ({ page }) => {
    const findings = await render(
      page,
      '.row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }',
      `<div class="app-shell"><aside class="nav"><div class="panel" style="background:#222;height:100%"></div></aside>
       <main class="page-content"><div class="row"><div class="card">a</div><div class="card">b<br>b</div></div>
       <div class="card" style="margin-top:16px">c</div></main></div>`,
    );
    expect(findings).toEqual([]);
  });

  test('a sidebar panel that stops before the page ends', async ({ page }) => {
    const findings = await render(
      page,
      '.panel { position: sticky; top: 0; height: 100vh; background: #222; }',
      `<div class="app-shell"><aside class="nav"><div class="panel">menu</div></aside>
       <main class="page-content"><div class="card" style="height:1400px">long</div></main></div>`,
    );
    expect(rules(findings)).toEqual(['edge:panel-short']);
    expect(findings[0].element).toBe('aside.nav > div.panel');
  });

  test('a sidebar whose column is painted to the end passes', async ({ page }) => {
    const findings = await render(
      page,
      `.nav { background: #111; }
       .panel { position: sticky; top: 0; height: 100vh; background: #222; }`,
      `<div class="app-shell"><aside class="nav"><div class="panel">menu</div></aside>
       <main class="page-content"><div class="card" style="height:1400px">long</div></main></div>`,
    );
    expect(findings).toEqual([]);
  });

  test('a column divider shorter than its card', async ({ page }) => {
    const findings = await render(
      page,
      `.split { display: grid; grid-template-columns: 1fr 1fr; padding: 24px; background: #eee; border-radius: 16px; }
       .right { border-left: 1px solid #999; padding-left: 24px; }`,
      `<div class="app-shell"><aside></aside><main class="page-content">
       <section class="split"><div style="height:300px">left</div><div class="right">right</div></section></main></div>`,
    );
    expect(rules(findings)).toEqual(['edge:divider-short']);
  });

  test('cards of different heights in one row', async ({ page }) => {
    const findings = await render(
      page,
      '.row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }',
      `<div class="app-shell"><aside></aside><main class="page-content"><div class="row">
       <div class="card" style="height:100px">a</div><div class="card" style="height:200px">b</div></div></main></div>`,
    );
    expect(rules(findings)).toEqual(['siblings:heights']);
  });

  test('cards of different heights inside component hosts of one row', async ({ page }) => {
    const findings = await render(
      page,
      `app-host { display: block; }
       .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }`,
      `<div class="app-shell"><aside></aside><main class="page-content"><div class="row">
       <app-host><div class="card" style="height:100px">a</div></app-host>
       <app-host><div class="card" style="height:200px">b</div></app-host></div></main></div>`,
    );
    expect(rules(findings)).toEqual(['siblings:heights']);
  });

  test('a stacked card narrower than the one above', async ({ page }) => {
    const findings = await render(
      page,
      '.narrow { max-width: 400px; margin-top: 16px; }',
      `<div class="app-shell"><aside></aside><main class="page-content">
       <div class="card" style="height:100px">wide</div><div class="card narrow" style="height:100px">narrow</div>
       </main></div>`,
    );
    expect(rules(findings)).toEqual(['edge:right-edge']);
  });

  test('a half-width card in a grid row under a full-width one is not a short edge', async ({
    page,
  }) => {
    const findings = await render(
      page,
      '.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } .wide { grid-column: span 2; }',
      `<div class="app-shell"><aside></aside><main class="page-content"><div class="grid">
       <div class="card wide" style="height:100px">wide</div>
       <div class="card" style="height:100px">a</div><div class="card" style="height:100px">b</div>
       </div></main></div>`,
    );
    expect(findings).toEqual([]);
  });

  test('stacked cards whose content starts at different insets', async ({ page }) => {
    const findings = await render(
      page,
      'app-host { display: block; } .roomy { padding: 32px; margin-top: 16px; }',
      `<div class="app-shell"><aside></aside><main class="page-content">
       <div class="card" style="height:100px">first</div>
       <app-host><div class="card roomy" style="height:100px">second</div></app-host>
       </main></div>`,
    );
    expect(rules(findings)).toEqual(['siblings:insets']);
  });

  test('paddings and gaps off the scale', async ({ page }) => {
    const findings = await render(
      page,
      '.odd { padding: 10px 16px; display: flex; gap: 6px; }',
      `<div class="app-shell"><aside></aside><main class="page-content">
       <div class="odd"><span>a</span><span>b</span></div></main></div>`,
    );
    expect(
      findings.filter((finding) => finding.kind === 'scale').map((finding) => finding.detail),
    ).toEqual(['padding-top 10px', 'padding-bottom 10px', 'row-gap 6px', 'column-gap 6px']);
  });
});
