import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { designRoot, type AxeRecord, type ShotRecord, type TestRecord } from './support';
import type { LayoutKind, PieceType } from '../support/layout-checks';

const IMPACTS = ['critical', 'serious', 'moderate', 'minor'] as const;

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function byImpact(runs: AxeRecord[]): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(IMPACTS.map((impact) => [impact, 0]));
  for (const run of runs)
    for (const rule of run.violations) totals[rule.impact] = (totals[rule.impact] ?? 0) + 1;
  return totals;
}

function summary(records: TestRecord[], shots: ShotRecord[], runs: AxeRecord[]): string {
  const lines: string[] = [];
  const failed = records.filter((record) => record.status !== 'passed');
  lines.push(
    `# Design capture · ${new Date().toISOString()}`,
    '',
    `- Tests: ${records.length} (${failed.length} not passed)`,
    `- Screenshots: ${shots.length}`,
    `- axe runs: ${runs.length}`,
    '',
    '## axe: rules (instances = rule × view; nodes = elements)',
    '',
    '| Rule | Impact | Kind | Instances | Nodes | Screens |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  const rules = new Map<
    string,
    { impact: string; kind: string; instances: number; nodes: number; screens: Set<string> }
  >();
  for (const run of runs) {
    for (const rule of run.violations) {
      const entry = rules.get(rule.id) ?? {
        impact: rule.impact,
        kind: rule.tags.includes('best-practice') ? 'best practice' : 'WCAG',
        instances: 0,
        nodes: 0,
        screens: new Set<string>(),
      };
      entry.instances += 1;
      entry.nodes += rule.nodes;
      entry.screens.add(run.screen);
      rules.set(rule.id, entry);
    }
  }
  const order = (impact: string): number => IMPACTS.indexOf(impact as (typeof IMPACTS)[number]);
  for (const [id, rule] of [...rules].sort(
    (a, b) => order(a[1].impact) - order(b[1].impact) || b[1].nodes - a[1].nodes,
  )) {
    lines.push(
      `| ${id} | ${rule.impact} | ${rule.kind} | ${rule.instances} | ${rule.nodes} | ${[...rule.screens].sort().join(', ')} |`,
    );
  }
  const totals = byImpact(runs);
  lines.push(
    '',
    `Totals (instances): ${IMPACTS.map((impact) => `${impact} ${totals[impact]}`).join(' · ')}`,
    '',
  );

  lines.push(
    '## axe: per view',
    '',
    '| Screen | Who | View | Theme | Critical | Serious | Moderate | Minor | File |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const run of [...runs].sort((a, b) =>
    `${a.screen}${a.who}${a.view}${a.theme}`.localeCompare(
      `${b.screen}${b.who}${b.view}${b.theme}`,
    ),
  )) {
    const counts = byImpact([run]);
    lines.push(
      `| ${run.screen} | ${run.who} | ${run.view} | ${run.theme} | ${IMPACTS.map((impact) => counts[impact]).join(' | ')} | ${run.file} |`,
    );
  }

  const incomplete = new Map<string, number>();
  for (const run of runs)
    for (const rule of run.incomplete)
      incomplete.set(rule.id, (incomplete.get(rule.id) ?? 0) + rule.nodes);
  lines.push('', '## axe: to check by eye (incomplete)', '');
  for (const [id, nodes] of [...incomplete].sort((a, b) => b[1] - a[1]))
    lines.push(`- ${id}: ${nodes} nodes`);

  lines.push(
    '',
    '## Horizontal overflow',
    '',
    '| Screen | Who | View | Width | Theme | Page scroll | Past the edge | File |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const shot of shots.filter((item) => item.overflowPx > 0 || item.offenders.length)) {
    lines.push(
      `| ${shot.screen} | ${shot.who} | ${shot.view} | ${shot.width} | ${shot.theme} | ${shot.overflowPx}px | ${cell(shot.offenders.join(', '))} | ${shot.file} |`,
    );
  }

  lines.push(...layoutSection(shots));

  lines.push('', '## Notes (keyboard focus)', '');
  for (const shot of shots.filter((item) => item.notes.length))
    lines.push(`- ${shot.screen} · ${shot.theme}: ${shot.notes.join('; ')}`);

  lines.push('', '## Problems', '');
  for (const record of records) {
    const problems = [
      ...(record.error ? [`test ${record.status}: ${record.error}`] : []),
      ...record.problems,
    ];
    if (problems.length)
      lines.push(
        `- **${record.title}**: ${problems.map((item) => cell(item.slice(0, 240))).join(' · ')}`,
      );
  }
  return `${lines.join('\n')}\n`;
}

/** One finding in one view: the rows of layout.json. */
export interface LayoutRow {
  screen: string;
  who: string;
  view: string;
  width: number;
  theme: string;
  kind: LayoutKind;
  rule: string;
  element: string;
  detail: string;
  px: number;
  file: string;
}

export function layoutRows(shots: ShotRecord[]): LayoutRow[] {
  return shots.flatMap((shot) =>
    (shot.layout ?? []).map((finding) => ({
      screen: shot.screen,
      who: shot.who,
      view: shot.view,
      width: shot.width,
      theme: shot.theme,
      ...finding,
      file: shot.file,
    })),
  );
}

const KIND_TITLES: Record<LayoutKind, string> = {
  edge: 'Edges ending inside another box',
  siblings: 'Siblings out of line',
  scale: 'Paddings and gaps off the spacing scale',
};

/** A finding without the view: what a fix removes everywhere at once. */
function findingKey(row: LayoutRow): string {
  return row.kind === 'scale'
    ? `${row.rule}|${row.element}|${row.detail}`
    : `${row.rule}|${row.element}`;
}

interface Distinct {
  rule: string;
  element: string;
  detail: string;
  px: number;
  views: number;
  where: Set<string>;
  file: string;
}

function distinct(rows: LayoutRow[]): Distinct[] {
  const map = new Map<string, Distinct>();
  for (const row of rows) {
    const key = findingKey(row);
    const entry = map.get(key) ?? {
      rule: row.rule,
      element: row.element,
      detail: row.detail,
      px: row.px,
      views: 0,
      where: new Set<string>(),
      file: row.file,
    };
    entry.views += 1;
    entry.px = Math.max(entry.px, row.px);
    entry.where.add(`${row.screen} ${row.width}`);
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.views - a.views || b.px - a.px);
}

/** Paddings each piece type uses: padding → the distinct screen · element pairs. */
export function piecePaddings(shots: ShotRecord[]): Map<PieceType, Map<string, Set<string>>> {
  const types = new Map<PieceType, Map<string, Set<string>>>();
  for (const shot of shots) {
    for (const piece of shot.pieces ?? []) {
      const paddings = types.get(piece.type) ?? new Map<string, Set<string>>();
      const users = paddings.get(piece.padding) ?? new Set<string>();
      users.add(`${shot.screen} · ${piece.element}`);
      paddings.set(piece.padding, users);
      types.set(piece.type, paddings);
    }
  }
  return types;
}

/** The counts the PR compares before and after: per check, distinct findings, instances and views. */
export function layoutCounts(shots: ShotRecord[]): Record<string, number> {
  const rows = layoutRows(shots);
  const counts: Record<string, number> = {};
  for (const kind of Object.keys(KIND_TITLES) as LayoutKind[]) {
    const ofKind = rows.filter((row) => row.kind === kind);
    counts[`${kind}.distinct`] = distinct(ofKind).length;
    counts[`${kind}.instances`] = ofKind.length;
    counts[`${kind}.views`] = new Set(ofKind.map((row) => row.file)).size;
  }
  let offDominant = 0;
  let mixedTypes = 0;
  for (const paddings of piecePaddings(shots).values()) {
    const sorted = [...paddings.values()].sort((a, b) => b.size - a.size);
    if (sorted.length > 1) mixedTypes += 1;
    offDominant += sorted.slice(1).reduce((sum, users) => sum + users.size, 0);
  }
  counts['pieces.mixedTypes'] = mixedTypes;
  counts['pieces.offDominant'] = offDominant;
  return counts;
}

const LIST_LIMIT = 120;

function layoutSection(shots: ShotRecord[]): string[] {
  const rows = layoutRows(shots);
  const counts = layoutCounts(shots);
  const lines = [
    '',
    '## Alignment and spacing (F19.8)',
    '',
    'Machine-readable list: `layout.json` (one row per finding and view). «Distinct» counts a finding once however',
    'many views show it (a scale finding is element · property · value).',
    '',
    '| Check | Distinct | Instances (finding × view) | Views |',
    '| --- | --- | --- | --- |',
  ];
  for (const kind of Object.keys(KIND_TITLES) as LayoutKind[]) {
    lines.push(
      `| ${KIND_TITLES[kind]} (\`${kind}\`) | ${counts[`${kind}.distinct`]} | ${counts[`${kind}.instances`]} | ${counts[`${kind}.views`]} |`,
    );
  }
  lines.push(
    `| Piece types with more than one padding | ${counts['pieces.mixedTypes']} | — | — |`,
    `| Pieces (screen · element) off their type's most used padding | ${counts['pieces.offDominant']} | — | — |`,
  );
  for (const kind of Object.keys(KIND_TITLES) as LayoutKind[]) {
    const list = distinct(rows.filter((row) => row.kind === kind));
    lines.push(
      '',
      `### ${KIND_TITLES[kind]}`,
      '',
      '| Rule | Element | Detail (largest) | Views | Where (screen width) | Example |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (const item of list.slice(0, LIST_LIMIT)) {
      const where = [...item.where].sort();
      lines.push(
        `| ${item.rule} | ${cell(item.element)} | ${cell(item.detail)} | ${item.views} | ${cell(where.slice(0, 6).join(', '))}${where.length > 6 ? ` +${where.length - 6}` : ''} | ${item.file} |`,
      );
    }
    if (list.length > LIST_LIMIT)
      lines.push('', `… ${list.length - LIST_LIMIT} more in layout.json.`);
  }
  lines.push(
    '',
    '### Paddings per piece type',
    '',
    'Computed padding (top right bottom left, px) of each typed piece, with the screen · element pairs that use it.',
    '',
    '| Type | Padding | Uses | Examples |',
    '| --- | --- | --- | --- |',
  );
  for (const [type, paddings] of [...piecePaddings(shots)].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    for (const [padding, users] of [...paddings].sort((a, b) => b[1].size - a[1].size)) {
      const examples = [...users].sort();
      lines.push(
        `| ${type} | ${padding} | ${users.size} | ${cell(examples.slice(0, 4).join('; '))}${examples.length > 4 ? ` +${examples.length - 4}` : ''} |`,
      );
    }
  }
  return lines;
}

function gallery(shots: ShotRecord[]): string {
  const screens = [...new Set(shots.map((shot) => shot.screen))].sort();
  const sections = screens.map((screen) => {
    const ofScreen = shots.filter((shot) => shot.screen === screen);
    const rows = [...new Set(ofScreen.map((shot) => `${shot.who}|${shot.view}`))].map((key) => {
      const [who, view] = key.split('|');
      const cells = ofScreen
        .filter((shot) => shot.who === who && shot.view === view)
        .sort((a, b) => a.theme.localeCompare(b.theme) || a.width - b.width)
        .map((shot) => {
          const flag = shot.overflowPx > 0 || shot.offenders.length ? ' class="overflow"' : '';
          return `<figure${flag}><a href="${escapeHtml(shot.file)}"><img loading="lazy" src="${escapeHtml(shot.file)}" alt=""></a><figcaption>${shot.width} · ${shot.theme}${shot.overflowPx ? ` · +${shot.overflowPx}px` : ''}</figcaption></figure>`;
        })
        .join('');
      return `<div class="row"><h3>${escapeHtml(who ?? '')} · ${escapeHtml(view ?? '')}</h3><div class="cells">${cells}</div></div>`;
    });
    return `<section id="${escapeHtml(screen)}"><h2>${escapeHtml(screen)}</h2>${rows.join('')}</section>`;
  });
  const nav = screens
    .map((screen) => `<a href="#${escapeHtml(screen)}">${escapeHtml(screen)}</a>`)
    .join(' ');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design capture</title>
<style>
body{margin:0;padding:16px 24px;font:14px/1.4 system-ui,sans-serif;background:#f4f2f7;color:#221a2b}
nav{position:sticky;top:0;padding:8px 0;background:#f4f2f7;display:flex;flex-wrap:wrap;gap:8px}
nav a{color:#5b1a7a}
section{margin:24px 0}h2{margin:0 0 8px}h3{margin:12px 0 4px;font-size:13px;color:#5d5368}
.cells{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
figure{margin:0;width:200px}figure img{width:200px;max-height:320px;object-fit:cover;object-position:top;border:1px solid #d9d2e1;background:#fff}
figure.overflow img{border:2px solid #c2185b}figcaption{font-size:12px;color:#5d5368}
</style></head><body>
<h1>Design capture</h1><p>${shots.length} screenshots. A red frame marks horizontal overflow. See summary.md for axe and the problems.</p>
<nav>${nav}</nav>
${sections.join('\n')}
</body></html>
`;
}

/** Global teardown of the design run: index.json, summary.md and the gallery (index.html) in the capture folder. */
export default async function designReport(): Promise<void> {
  const root = designRoot();
  const metaDir = join(root, 'meta');
  if (!existsSync(metaDir)) return;
  const records = readdirSync(metaDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(metaDir, file), 'utf8')) as TestRecord)
    .sort((a, b) => a.title.localeCompare(b.title));
  const shots = records.flatMap((record) => record.shots);
  const runs = records.flatMap((record) => record.axe);
  writeFileSync(join(root, 'index.json'), JSON.stringify({ records }, null, 2));
  writeFileSync(join(root, 'summary.md'), summary(records, shots, runs));
  writeFileSync(
    join(root, 'layout.json'),
    JSON.stringify(
      {
        counts: layoutCounts(shots),
        findings: layoutRows(shots),
        pieces: Object.fromEntries(
          [...piecePaddings(shots)].map(([type, paddings]) => [
            type,
            Object.fromEntries(
              [...paddings].map(([padding, users]) => [padding, [...users].sort()]),
            ),
          ]),
        ),
      },
      null,
      2,
    ),
  );
  writeFileSync(join(root, 'index.html'), gallery(shots));
  console.log(`design capture: ${shots.length} screenshots, ${runs.length} axe runs in ${root}`);
}
