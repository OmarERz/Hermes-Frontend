import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { designRoot, type AxeRecord, type ShotRecord, type TestRecord } from './support';

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

  lines.push('', '## Notes (keyboard focus)', '');
  for (const shot of shots.filter((item) => item.notes.length))
    lines.push(`- ${shot.screen} · ${shot.theme}: ${shot.notes.join('; ')}`);

  lines.push('', '## Problems', '');
  for (const record of records) {
    const problems = [
      ...(record.error ? [`test ${record.status}: ${record.error}`] : []),
      ...record.problems,
    ];
    if (problems.length) lines.push(`- **${record.title}**: ${problems.map(cell).join(' · ')}`);
  }
  return `${lines.join('\n')}\n`;
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
  writeFileSync(join(root, 'index.html'), gallery(shots));
  console.log(`design capture: ${shots.length} screenshots, ${runs.length} axe runs in ${root}`);
}
