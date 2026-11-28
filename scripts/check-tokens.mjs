#!/usr/bin/env node
/**
 * Spacing, type and radius come from the tokens of src/styles/tokens.css (F19.10, D-108: «que todos los paddings sean
 * uniformes»). This check fails on a raw length in those properties of any stylesheet of the front:
 * - padding*, margin*, gap, row-gap, column-gap: only var(--…) tokens, 0, auto, percentages and 1 px (a hairline
 *   nudge, like the margin: -1px of the visually hidden pattern);
 * - font-size: only var(--text-…), inherit, a percentage or a keyword;
 * - border-radius*: only var(--radius-…), 0, a percentage or 1 px.
 * It reads every .css under src/ (tokens.css defines the tokens, so it is skipped) and the inline `styles` of the
 * components (.ts). A documented exception carries `tokens-exception: <why>` in a comment on its line or the line
 * above. Run by `npm run lint` (so by `npm run verify`, the local gate and CI), after its own cases (--self-test).
 * Usage: node scripts/check-tokens.mjs [--self-test] [files…]   (no files: all of src/)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set([join(ROOT, 'src/styles/tokens.css')]);

const SPACING =
  /^(padding|margin)(-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?$|^(row-|column-)?gap$/;
const RADIUS = /^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$/;
/** A number with a unit (px, em, rem, any viewport or container unit…): only % is not a length here. */
const LENGTH = /(^|[^\w.-])(-?\d*\.?\d+)([a-z]+)\b/gi;

function files(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...files(path));
    else if (/\.(css|ts)$/.test(name) && !/\.spec\.ts$|\.d\.ts$/.test(name)) found.push(path);
  }
  return found;
}

/** The raw lengths a declaration may not use; empty when it is fine. */
export function offending(property, value) {
  const name = property.toLowerCase();
  const kind = SPACING.test(name)
    ? 'spacing'
    : name === 'font-size'
      ? 'font-size'
      : RADIUS.test(name)
        ? 'radius'
        : null;
  if (!kind) return [];
  const bad = [];
  for (const match of value.matchAll(LENGTH)) {
    const number = Math.abs(parseFloat(match[2]));
    if (number === 0) continue;
    if (kind !== 'font-size' && match[3] === 'px' && number === 1) continue;
    bad.push(`${match[2]}${match[3]}`);
  }
  return bad;
}

/**
 * The CSS a file holds, as [offset, text] chunks: a stylesheet whole, or the inline `styles` of a component (each
 * template literal after `styles:`, also `styles: [\`…\`, \`…\`]`).
 */
function sources(text, isTs) {
  if (!isTs) return [[0, text]];
  const chunks = [];
  const start = /styles\s*:\s*\[?/g;
  for (let match = start.exec(text); match; match = start.exec(text)) {
    let at = match.index + match[0].length;
    // One or more template literals separated by commas, up to the closing bracket.
    for (;;) {
      while (/[\s,]/.test(text[at] ?? '')) at += 1;
      if (text[at] !== '`') break;
      const close = text.indexOf('`', at + 1);
      if (close < 0) break;
      chunks.push([at + 1, text.slice(at + 1, close)]);
      at = close + 1;
    }
  }
  return chunks;
}

/**
 * Declarations of the CSS (a value may span lines; comments do not count): [offset, property, value]. Custom
 * properties (--name) define tokens and are skipped.
 */
function declarations(css) {
  const blanked = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const found = [];
  const declaration = /(^|[{;\s])([a-zA-Z-]+)\s*:\s*([^;{}]+?)\s*(?=;|}|$)/g;
  for (let match = declaration.exec(blanked); match; match = declaration.exec(blanked)) {
    const property = match[2];
    // A selector with a pseudo-class («a:hover {») is followed by a brace, not a declaration end.
    const after = blanked.slice(match.index + match[0].length).trimStart()[0];
    if (property.startsWith('--') || after === '{') continue;
    found.push([match.index + match[1].length, property, match[3]]);
  }
  return found;
}

/** Problems of one file's text, as «line: property: value (raw …)». */
export function checkText(text, isTs) {
  const lines = text.split('\n');
  const lineOf = (offset) => text.slice(0, offset).split('\n').length - 1;
  const problems = [];
  for (const [base, css] of sources(text, isTs)) {
    for (const [offset, property, value] of declarations(css)) {
      const bad = offending(property, value);
      if (!bad.length) continue;
      const index = lineOf(base + offset);
      const near = `${lines[index]}\n${index > 0 ? lines[index - 1] : ''}`;
      if (/tokens-exception:\s*\S/.test(near)) continue;
      problems.push(
        `${index + 1}: ${property}: ${value.replace(/\s+/g, ' ').trim()} (raw ${bad.join(', ')})`,
      );
    }
  }
  return problems;
}

/** The check's own cases: what it must reject and what it must let through. */
function selfTest() {
  const cases = [
    ['a { padding: 10px; }', false, 1],
    ['a {\n  padding: var(--space-3) var(--card-pad);\n}', false, 0],
    ['a {\n  margin: -1px;\n  gap: 0;\n  margin: 0 auto;\n}', false, 0],
    ['a {\n  gap: 6px 8px;\n}', false, 1],
    ['a {\n  font-size: calc(12px + var(--font-size-increase));\n}', false, 1],
    ['a {\n  font-size: var(--text-sm);\n  border-radius: 50%;\n}', false, 0],
    ['a {\n  border-radius: 14px;\n  border-top-left-radius: 7px;\n}', false, 2],
    ['a {\n  padding: 0.5em;\n}', false, 1],
    ['a {\n  /* tokens-exception: the native control */\n  padding: 3px;\n}', false, 0],
    ['a {\n  --peek: 28px;\n  width: 28px;\n  top: 14px;\n}', false, 0],
    ['@Component({\n  styles: `\n    a {\n      padding: 6px;\n    }\n  `,\n})', true, 1],
    ['const css = "padding: 6px;";', true, 0],
    ['a {\n  padding:\n    10px\n    var(--space-2);\n}', false, 1],
    ['@Component({ styles: `a { padding: 6px; }` })', true, 1],
    ['@Component({\n  styles: [`a { gap: 0; }`, `b { margin: 3dvh; }`],\n})', true, 1],
    ['a {\n  height: 100dvh;\n  padding-block: 2svh;\n}', false, 1],
    ['a:hover,\nb:focus-visible {\n  margin: 0;\n}', false, 0],
    ['a { padding: var(--space-0-5) var(--text-2xs); }', false, 0],
  ];
  const failed = cases.filter(([text, isTs, count]) => checkText(text, isTs).length !== count);
  if (failed.length) {
    console.error(`check-tokens: ${failed.length} self-test case(s) failed:`);
    for (const [text] of failed) console.error(`  ${JSON.stringify(text)}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) selfTest();
  const named = args.filter((arg) => !arg.startsWith('--'));
  const paths = named.length
    ? named.map((arg) => resolve(process.cwd(), arg))
    : files(join(ROOT, 'src'));
  const problems = [];
  for (const path of paths) {
    if (SKIP.has(path)) continue;
    for (const problem of checkText(readFileSync(path, 'utf8'), path.endsWith('.ts')))
      problems.push(`${relative(ROOT, path)}:${problem}`);
  }
  if (problems.length) {
    console.error(
      `check-tokens: ${problems.length} declaration(s) with a raw length; use the tokens of src/styles/tokens.css ` +
        '(or add `tokens-exception: <why>` in a comment):',
    );
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(`check-tokens: ${paths.length} files, no raw spacing, font size or radius`);
}
