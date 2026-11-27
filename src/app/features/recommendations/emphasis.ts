/** A run of text, strong (between `**` markers) or plain. */
export interface EmphasisSegment {
  readonly text: string;
  readonly strong: boolean;
}

/** Characters the backend escapes with a backslash so a name stays literal (core/mitigation/text.py, MARKDOWN). */
const ESCAPABLE = new Set(['\\', '`', '*', '_', '[', ']', '#', '>', '|', '~', '<']);

type Token = { kind: 'text'; text: string } | { kind: 'marker' };

/**
 * Reads the justification of an evaluation (docs/06 §6): a code template that wraps its headings in `**…**` and
 * escapes every outside name with backslashes. Only that subset is understood: `**` toggles strong and `\x` is the
 * literal `x`. Everything else, HTML included, stays plain text, and the segments are rendered with interpolation
 * (never as HTML), so nothing in the text can inject markup (REC-2, SEG-02). An unpaired `**` stays literal.
 */
export function parseEmphasis(source: string): EmphasisSegment[] {
  const tokens: Token[] = [];
  let buffer = '';
  const flush = (): void => {
    if (buffer) tokens.push({ kind: 'text', text: buffer });
    buffer = '';
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '\\' && next !== undefined && ESCAPABLE.has(next)) {
      buffer += next;
      index++;
    } else if (char === '*' && next === '*') {
      flush();
      tokens.push({ kind: 'marker' });
      index++;
    } else {
      buffer += char;
    }
  }
  flush();

  const markers = tokens.filter((token) => token.kind === 'marker').length;
  let unpaired = markers % 2; // the last marker has no partner: it is text
  let seen = 0;
  let strong = false;
  const segments: EmphasisSegment[] = [];
  const push = (text: string, isStrong: boolean): void => {
    const last = segments.at(-1);
    if (last && last.strong === isStrong) {
      segments[segments.length - 1] = { text: last.text + text, strong: isStrong };
    } else {
      segments.push({ text, strong: isStrong });
    }
  };
  for (const token of tokens) {
    if (token.kind === 'text') {
      push(token.text, strong);
      continue;
    }
    seen++;
    if (unpaired && seen === markers) {
      push('**', strong);
      unpaired = 0;
    } else {
      strong = !strong;
    }
  }
  return segments.filter((segment) => segment.text.length > 0);
}
