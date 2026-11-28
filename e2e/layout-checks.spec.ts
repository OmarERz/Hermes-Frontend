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

  test('piece types and their paddings (F19.10)', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.setContent(`<!doctype html><style>${BASE}
      .box { background: #eee; border-radius: 16px; min-height: 80px; }
      .cols { display: grid; grid-template-columns: 1fr 1fr; padding: 0; }
      .cols > div { padding: 20px; }
      .badge { display: inline-flex; width: 400px; min-height: 80px; padding: 6px; background: #eee; border-radius: 16px; }
      table { border-collapse: collapse; } td { padding: 8px 12px; }
      .cards tr { display: grid; padding: 16px; background: #eee; border-radius: 12px; min-width: 200px; min-height: 70px; }
      .cards td { display: block; padding: 0; }
      dialog { padding: 0; } dialog > div { padding: 20px; }
      </style>
      <div class="app-shell"><aside></aside><main class="page-content">
        <section class="box" style="padding:20px"><h2>panel</h2>
          <div class="box" style="padding:16px;width:300px">sub-card</div></section>
        <section class="box cols"><div>left</div><div>right</div></section>
        <div class="box" style="padding:20px;width:300px">card</div>
        <p class="box" role="status" style="padding:12px 20px">notice</p>
        <section class="box" role="alert" style="padding:20px"><h2>Sin permiso</h2></section>
        <span class="badge">badge</span>
        <label class="field" style="display:grid;gap:4px">Name<input></label>
        <fieldset style="display:grid;gap:8px;padding:0;border:0"><label>a<input type="radio"></label></fieldset>
        <table><tbody><tr><td>cell</td></tr></tbody></table>
        <table class="cards"><tbody><tr><td>row</td></tr></tbody></table>
        <dialog open><div>dialog</div></dialog>
      </main></div>`);
    const { pieces } = await checkLayout(page, { kinds: [] });
    const seen = pieces.map((piece) => `${piece.type} ${piece.padding}`);
    expect(seen).toEqual(
      expect.arrayContaining([
        'panel 20 20 20 20',
        'sub-card 16 16 16 16',
        'card 20 20 20 20',
        'notice 12 20 12 20',
        'field 0 0 0 0 · gap 4',
        'form-group 0 0 0 0 · gap 8',
        'table-cell 8 12 8 12',
        'sub-card 16 16 16 16',
        'dialog inline 20',
      ]),
    );
    // The edge-to-edge columns give their padding to the box; «Sin permiso» (a heading) is a panel, not a notice.
    expect(seen.filter((item) => item === 'panel 20 20 20 20')).toHaveLength(3);
    // The badge is inline (never a box) and the cells of a row shown as a card are not table cells.
    expect(seen.join('|')).not.toContain('6 6 6 6');
    expect(seen).not.toContain('table-cell 0 0 0 0');
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
