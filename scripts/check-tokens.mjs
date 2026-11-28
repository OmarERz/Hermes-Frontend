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
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set([join(ROOT, 'src/styles/tokens.css')]);

const SPACING =
  /^(padding|margin)(-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?$|^(row-|column-)?gap$/;
const RADIUS = /^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$/;
/** A length with a unit other than %: px, em, rem, vw, vh… */
const LENGTH = /(^|[^\w.-])(-?\d*\.?\d+)(px|em|rem|vw|vh|vmin|vmax|ch|ex|cqw|cqh|pt)\b/g;

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

/** Declarations of a stylesheet (or of a component's inline styles): [line index, property, value]. */
function declarations(lines, isTs) {
  const found = [];
  let inStyles = !isTs;
  lines.forEach((line, index) => {
    if (isTs) {
      if (/styles:\s*\[?\s*`/.test(line)) {
        inStyles = true;
        return;
      }
      if (inStyles && /^\s*`/.test(line)) inStyles = false;
      if (!inStyles) return;
    }
    // Every «property: value» of the line, also inside a one-line rule (comments dropped).
    for (const part of line.replace(/\/\*.*?\*\//g, '').split(/[{};]/)) {
      const match = /^\s*([a-z-]+)\s*:\s*(.+?)\s*$/i.exec(part);
      if (match && !match[1].startsWith('--')) found.push([index, match[1], match[2]]);
    }
  });
  return found;
}

/** Problems of one file's text, as «line: property: value (raw …)». */
export function checkText(text, isTs) {
  const lines = text.split('\n');
  const problems = [];
  if (isTs && !/styles:\s*\[?\s*`/.test(text)) return problems;
  for (const [index, property, value] of declarations(lines, isTs)) {
    const bad = offending(property, value);
    if (!bad.length) continue;
    const near = `${lines[index]}\n${index > 0 ? lines[index - 1] : ''}`;
    if (/tokens-exception:\s*\S/.test(near)) continue;
    problems.push(`${index + 1}: ${property}: ${value.trim()} (raw ${bad.join(', ')})`);
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
    ? named.map((arg) => join(process.cwd(), arg))
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
