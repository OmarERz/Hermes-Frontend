import type { Page } from '@playwright/test';

/**
 * Alignment and consistency checks of a rendered page (F19.8, D-108: «que todos los paddings sean uniformes […] que
 * todo esté alineado y no quede el final de algo en medio de otro borde»). Shared by the design capture (every view,
 * reported in its summary.md and layout.json) and the e2e guard (e2e/layout.spec.ts, edges only).
 *
 * Kinds of finding:
 * - `edge`: an edge that ends inside another box. A panel shorter than the column it fills (the sidebar that stops
 *   at the viewport's height while the page goes on), a column divider shorter than its card, a card whose right
 *   edge stops inside the band of the card stacked next to it.
 * - `siblings`: cards in the same row of a flex or grid container with different top edges or heights.
 * - `scale`: a computed padding or gap that is not a step of the spacing scale (src/styles/tokens.css).
 * Besides the findings, every piece with a type (panel, card, sub-card, indicator, table cell, dialog, form group,
 * banner) records its computed padding, so the report can tell the paddings each type uses across the screens.
 *
 * What a check skips: elements that are not rendered or are invisible, SVG and chart internals, fixed elements (the
 * phone bar, dialogs, tooltips: they belong to the viewport, not to the page) and, for the edge and sibling checks,
 * anything inside a horizontal scroller (table rows lay out on their own) or under a transform (the source carousel
 * scales its side cards on purpose).
 */
export type LayoutKind = 'edge' | 'siblings' | 'scale';

export interface LayoutFinding {
  kind: LayoutKind;
  /** Which rule: panel-short, divider-short, right-edge, tops, heights, padding, gap. */
  rule: string;
  /** The element, as `parent > element` with up to two classes each. */
  element: string;
  detail: string;
  /** Size of the misalignment in px (or the off-scale value). */
  px: number;
}

export type PieceType =
  'panel' | 'card' | 'sub-card' | 'indicator' | 'table-cell' | 'dialog' | 'form-group' | 'banner';

export interface PieceRecord {
  type: PieceType;
  element: string;
  /** Computed padding as «top right bottom left» in px (a form group adds its gap). */
  padding: string;
}

export interface LayoutResult {
  findings: LayoutFinding[];
  pieces: PieceRecord[];
}

/** The spacing scale of src/styles/tokens.css (--space-*), in px. Above 64 px any multiple of 8 is accepted. */
export const SPACING_SCALE = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64];

/** Two edges closer than this (px) count as the same line: rounding and 1 px borders. */
export const TOLERANCE = 2;

export const ALL_KINDS: readonly LayoutKind[] = ['edge', 'siblings', 'scale'];

interface InPageOptions {
  scale: number[];
  tolerance: number;
  kinds: LayoutKind[];
  pieces: boolean;
}

/** Runs the checks on the page as it is now (theme, width and scroll position included). */
export function checkLayout(
  page: Page,
  options: { kinds?: readonly LayoutKind[]; pieces?: boolean } = {},
): Promise<LayoutResult> {
  const settings: InPageOptions = {
    scale: SPACING_SCALE,
    tolerance: TOLERANCE,
    kinds: [...(options.kinds ?? ALL_KINDS)],
    pieces: options.pieces ?? true,
  };
  return page.evaluate(inPage, settings);
}

/** Runs inside the page: self-contained (no imports or outer variables). */
function inPage(options: InPageOptions): LayoutResult {
  // Measured at the top of the page, so sticky pieces sit where the page starts (restored at the end).
  const scrolled = { x: scrollX, y: scrollY };
  window.scrollTo(0, 0);
  try {
    return measure(options);
  } finally {
    window.scrollTo(scrolled.x, scrolled.y);
  }

  function measure(options: InPageOptions): LayoutResult {
    const tol = options.tolerance;
    const kinds = new Set(options.kinds);
    const findings: LayoutFinding[] = [];
    const pieces: PieceRecord[] = [];
    const root = document.querySelector('.app-shell') ?? document.body;
    const page = document.querySelector('.page-content');

    const styles = new Map<Element, CSSStyleDeclaration>();
    const style = (element: Element): CSSStyleDeclaration => {
      let found = styles.get(element);
      if (!found) {
        found = getComputedStyle(element);
        styles.set(element, found);
      }
      return found;
    };
    interface Box {
      top: number;
      bottom: number;
      left: number;
      right: number;
      width: number;
      height: number;
    }
    const boxes = new Map<Element, Box>();
    /** Document coordinates, so the scroll position never matters. */
    const box = (element: Element): Box => {
      let found = boxes.get(element);
      if (!found) {
        const rect = element.getBoundingClientRect();
        found = {
          top: rect.top + scrollY,
          bottom: rect.bottom + scrollY,
          left: rect.left + scrollX,
          right: rect.right + scrollX,
          width: rect.width,
          height: rect.height,
        };
        boxes.set(element, found);
      }
      return found;
    };
    const px = (value: string): number => parseFloat(value) || 0;
    const round = (value: number): number => Math.round(value * 100) / 100;
    const name = (element: Element): string => {
      const classes = [...element.classList].slice(0, 2).join('.');
      return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${classes ? `.${classes}` : ''}`;
    };
    const signature = (element: Element): string =>
      element.parentElement && element.parentElement !== document.body
        ? `${name(element.parentElement)} > ${name(element)}`
        : name(element);
    /** Alpha of a computed colour (rgb(), rgba(), color(srgb … / a), transparent). */
    const alpha = (color: string): number => {
      if (!color || color === 'transparent') return 0;
      const slash = /\/\s*([\d.]+%?)\s*\)$/.exec(color);
      if (slash) return slash[1].endsWith('%') ? px(slash[1]) / 100 : px(slash[1]);
      const rgba = /^rgba\(([^)]+)\)$/.exec(color);
      if (rgba) return px(rgba[1].split(',')[3] ?? '1');
      return 1;
    };
    const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;
    type Side = (typeof SIDES)[number];
    const border = (element: Element, side: Side): number => {
      const css = style(element);
      const width = px(css.getPropertyValue(`border-${side.toLowerCase()}-width`));
      const kind = css.getPropertyValue(`border-${side.toLowerCase()}-style`);
      const color = css.getPropertyValue(`border-${side.toLowerCase()}-color`);
      return width >= 1 && kind !== 'none' && kind !== 'hidden' && alpha(color) > 0.04 ? width : 0;
    };
    const fill = (element: Element): boolean => {
      const css = style(element);
      return alpha(css.backgroundColor) > 0.04 || css.backgroundImage !== 'none';
    };
    /** Draws a box of its own: a fill, a border or a shadow. */
    const paints = (element: Element): boolean =>
      fill(element) ||
      style(element).boxShadow !== 'none' ||
      SIDES.some((side) => border(element, side) > 0);
    /** Only a vertical line: a left or right border and nothing else, or a 1–3 px wide filled strip. */
    const verticalDivider = (element: Element): boolean => {
      const own = box(element);
      if (own.width <= 3 && own.height >= 16 && fill(element)) return true;
      return (
        !fill(element) &&
        style(element).boxShadow === 'none' &&
        border(element, 'Top') === 0 &&
        border(element, 'Bottom') === 0 &&
        (border(element, 'Left') > 0 || border(element, 'Right') > 0)
      );
    };

    const ignored = new Map<Element, boolean>();
    /** SVG and chart internals, hidden subtrees and fixed layers: not part of the page's layout. */
    const isIgnored = (element: Element): boolean => {
      const known = ignored.get(element);
      if (known !== undefined) return known;
      const css = style(element);
      let result =
        element instanceof SVGElement ||
        element.tagName === 'CANVAS' ||
        element.hasAttribute('_echarts_instance_') ||
        css.position === 'fixed' ||
        css.display === 'none';
      if (!result && element.parentElement && element.parentElement !== document.body)
        result = isIgnored(element.parentElement);
      ignored.set(element, result);
      return result;
    };
    const free = new Map<Element, boolean>();
    /** Inside a horizontal scroller or under a transform: laid out by its own rules. */
    const isFree = (element: Element): boolean => {
      const known = free.get(element);
      if (known !== undefined) return known;
      let result = false;
      const parent = element.parentElement;
      if (parent && parent !== document.body) {
        const css = style(parent);
        result =
          css.overflowX === 'auto' ||
          css.overflowX === 'scroll' ||
          (css.transform !== 'none' && css.transform !== '') ||
          isFree(parent);
      }
      if (!result) {
        const own = style(element).transform;
        result = own !== 'none' && own !== '';
      }
      free.set(element, result);
      return result;
    };
    const visible = (element: Element): boolean => {
      const own = box(element);
      if (own.width < 1 || own.height < 1) return false;
      const check = (
        element as Element & { checkVisibility?(options: Record<string, boolean>): boolean }
      ).checkVisibility;
      return check
        ? check.call(element, {
            opacityProperty: true,
            visibilityProperty: true,
            contentVisibilityAuto: true,
          })
        : true;
    };
    const INLINE = new Set(['inline', 'inline-block', 'inline-flex', 'inline-grid', 'contents']);
    const blockLevel = (element: Element): boolean =>
      !INLINE.has(style(element).display) && !style(element).display.startsWith('table-');
    const rowContainer = (element: Element): boolean => {
      const css = style(element);
      if (css.display === 'grid' || css.display === 'inline-grid') return true;
      return (
        (css.display === 'flex' || css.display === 'inline-flex') &&
        (css.flexDirection === 'row' || css.flexDirection === 'row-reverse')
      );
    };
    const sideBySide = (a: Box, b: Box): boolean =>
      (b.left >= a.right - tol || b.right <= a.left + tol) &&
      b.top < a.bottom - tol &&
      b.bottom > a.top + tol;
    const stacked = (a: Box, b: Box): boolean => a.bottom <= b.top + tol || b.bottom <= a.top + tol;
    const add = (finding: LayoutFinding): void => {
      findings.push({ ...finding, px: Math.round(finding.px) });
    };

    const all = [...root.querySelectorAll('*')].filter(
      (element) => !isIgnored(element) && visible(element),
    );

    if (kinds.has('edge') || kinds.has('siblings')) {
      const laidOut = new Set(all.filter((element) => !isFree(element) && blockLevel(element)));
      const painted = new Set([...laidOut].filter(paints));
      const card = (element: Element): boolean => {
        const own = box(element);
        return painted.has(element) && own.width >= 120 && own.height >= 48;
      };
      /** The box a child draws: itself, or the only child of an unpainted wrapper that fills it (a component host). */
      const visual = (element: Element): Element => {
        let current = element;
        while (!painted.has(current) && current.children.length === 1) {
          const only = current.children[0];
          const outer = box(current);
          const inner = box(only);
          if (
            !laidOut.has(only) ||
            Math.abs(outer.left - inner.left) > tol ||
            Math.abs(outer.right - inner.right) > tol ||
            Math.abs(outer.top - inner.top) > tol ||
            Math.abs(outer.bottom - inner.bottom) > tol
          )
            break;
          current = only;
        }
        return current;
      };
      const blockCard = (element: Element): boolean =>
        card(element) &&
        box(element).height >= 64 &&
        box(element).width >= 160 &&
        px(style(element).borderTopLeftRadius) >= 12;
      /** Cards one directly above the other in the same parent (through wrappers), sharing their left edge. */
      const stackedPairs = (): [Element, Element][] => {
        const pairs: [Element, Element][] = [];
        const parents = new Set([...laidOut].map((element) => element.parentElement));
        for (const parent of parents) {
          if (!parent || parent === document.body) continue;
          const stack = [...parent.children]
            .filter((kid) => laidOut.has(kid) || kid.tagName.includes('-'))
            .map(visual)
            .filter(blockCard);
          for (let index = 1; index < stack.length; index += 1) {
            const above = box(stack[index - 1]);
            const below = box(stack[index]);
            if (stacked(above, below) && Math.abs(above.left - below.left) <= tol)
              pairs.push([stack[index - 1], stack[index]]);
          }
        }
        return pairs;
      };
      const hasNeighbour = (element: Element): boolean => {
        let node: Element = element;
        while (node.parentElement && visual(node.parentElement) === element)
          node = node.parentElement;
        const parent = node.parentElement;
        if (!parent) return false;
        return [...parent.children].some(
          (other) =>
            other !== node &&
            laidOut.has(other) &&
            card(visual(other)) &&
            sideBySide(box(element), box(visual(other))),
        );
      };
      /**
       * Where a card's content starts, from its left edge: its first text, image or control, or the first box drawn
       * inside it (an icon tile, a sub-card). Null for content that is centred (an empty or error state).
       */
      const contentInset = (element: Element): number | null => {
        const own = box(element);
        let left = Infinity;
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        );
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node instanceof Element) {
            const drawn =
              !(node instanceof SVGElement) &&
              !isIgnored(node) &&
              paints(node) &&
              box(node).width >= 16 &&
              box(node).height >= 16;
            if (
              (!drawn && !/^(IMG|INPUT|SELECT|TEXTAREA|BUTTON|svg)$/i.test(node.tagName)) ||
              !visible(node)
            )
              continue;
            left = Math.min(left, box(node).left);
          } else if (node.textContent?.trim()) {
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of range.getClientRects())
              if (rect.width > 0) left = Math.min(left, rect.left + scrollX);
          }
        }
        if (!Number.isFinite(left) || left - own.left > 0.25 * own.width) return null;
        return left - own.left;
      };

      if (kinds.has('edge')) {
        for (const element of painted) {
          const own = box(element);
          // Divider shorter than the box it divides (a column rule that stops at the card's padding).
          if (verticalDivider(element) && own.height >= 24) {
            let container = element.parentElement;
            while (container && container !== root && !paints(container))
              container = container.parentElement;
            if (container && container !== root) {
              const outer = box(container);
              const top = outer.top + border(container, 'Top');
              const bottom = outer.bottom - border(container, 'Bottom');
              const short = Math.max(own.top - top, bottom - own.bottom);
              if (own.height >= 0.4 * (bottom - top) && short > tol) {
                add({
                  kind: 'edge',
                  rule: 'divider-short',
                  element: signature(element),
                  detail: `divider ${Math.round(own.top - top)} px below the top and ${Math.round(bottom - own.bottom)} px above the bottom of ${name(container)}`,
                  px: short,
                });
              }
            }
            continue;
          }
          // Panel shorter than the column it fills: the first and last box of a stretched row item, ending above it.
          const column = element.parentElement;
          if (
            column &&
            column !== root &&
            !paints(column) &&
            column.parentElement &&
            rowContainer(column.parentElement)
          ) {
            const outer = box(column);
            const partners = [...column.parentElement.children].filter(
              (other) => other !== column && laidOut.has(other) && sideBySide(outer, box(other)),
            );
            const kids = [...column.children].filter((kid) => laidOut.has(kid));
            const lowest = Math.max(...kids.map((kid) => box(kid).bottom));
            const contentBottom =
              outer.bottom - px(style(column).paddingBottom) - border(column, 'Bottom');
            if (
              partners.length &&
              own.width >= 24 &&
              own.top - (outer.top + px(style(column).paddingTop)) <= tol &&
              lowest <= own.bottom + tol &&
              contentBottom - own.bottom > tol &&
              partners.some((other) => box(other).bottom > own.bottom + tol)
            ) {
              add({
                kind: 'edge',
                rule: 'panel-short',
                element: signature(element),
                detail: `ends at ${Math.round(own.bottom)} px; its column ${name(column)} and the content next to it go on to ${Math.round(contentBottom)} px`,
                px: contentBottom - own.bottom,
              });
            }
          }
        }
        // Right edge inside a stacked neighbour: cards one above the other, same left edge, different right edge.
        // A card with another card beside it is a cell of a grid row, not a narrower block.
        for (const [above, below] of stackedPairs()) {
          const top = box(above);
          const bottom = box(below);
          const gap = Math.abs(top.right - bottom.right);
          if (gap <= tol) continue;
          const narrow = top.right < bottom.right ? above : below;
          if (hasNeighbour(narrow)) continue;
          add({
            kind: 'edge',
            rule: 'right-edge',
            element: signature(narrow),
            detail: `right edge ${Math.round(gap)} px inside the ${narrow === below ? 'card above' : 'card below'}`,
            px: gap,
          });
        }
      }

      if (kinds.has('siblings')) {
        const containers = [...laidOut].filter(
          (element) => rowContainer(element) && element !== root,
        );
        for (const container of containers) {
          const kids = [...container.children].filter(card);
          if (kids.length < 2) continue;
          const rows: Element[][] = [];
          for (const kid of kids.sort((a, b) => box(a).top - box(b).top)) {
            const row = rows.find((members) =>
              members.every((member) => sideBySide(box(member), box(kid))),
            );
            if (row) row.push(kid);
            else rows.push([kid]);
          }
          for (const row of rows.filter((members) => members.length > 1)) {
            const tops = row.map((member) => box(member).top);
            const bottoms = row.map((member) => box(member).bottom);
            const heights = row.map((member) => Math.round(box(member).height));
            const topGap = Math.max(...tops) - Math.min(...tops);
            const bottomGap = Math.max(...bottoms) - Math.min(...bottoms);
            if (topGap > tol) {
              add({
                kind: 'siblings',
                rule: 'tops',
                element: signature(container),
                detail: `${row.length} cards (${row.map(name).join(', ')}) start ${Math.round(topGap)} px apart`,
                px: topGap,
              });
            } else if (bottomGap > tol) {
              add({
                kind: 'siblings',
                rule: 'heights',
                element: signature(container),
                detail: `${row.length} cards (${row.map(name).join(', ')}) of heights ${heights.join(' / ')} px`,
                px: bottomGap,
              });
            }
          }
        }
        // Stacked cards of the same width whose content starts at different distances from their left edge.
        for (const [above, below] of stackedPairs()) {
          if (Math.abs(box(above).right - box(below).right) > tol) continue;
          const first = contentInset(above);
          const second = contentInset(below);
          if (first === null || second === null || Math.abs(first - second) <= tol) continue;
          add({
            kind: 'siblings',
            rule: 'insets',
            element: `${signature(above)} / ${name(below)}`,
            detail: `content starts ${Math.round(first)} px in from the left in ${name(above)} and ${Math.round(second)} px in ${name(below)}`,
            px: Math.abs(first - second),
          });
        }
      }
    }

    if (kinds.has('scale')) {
      const steps = new Set(options.scale);
      const onScale = (value: number): boolean =>
        steps.has(value) || (value > Math.max(...options.scale) && value % 8 === 0);
      const seen = new Set<string>();
      for (const element of all) {
        const css = style(element);
        const report = (rule: string, property: string, value: number): void => {
          const key = `${signature(element)}|${property}|${value}`;
          if (seen.has(key)) return;
          seen.add(key);
          add({
            kind: 'scale',
            rule,
            element: signature(element),
            detail: `${property} ${value}px`,
            px: value,
          });
        };
        for (const side of SIDES) {
          const value = round(px(css.getPropertyValue(`padding-${side.toLowerCase()}`)));
          if (!onScale(value)) report('padding', `padding-${side.toLowerCase()}`, value);
        }
        const layout = css.display;
        if (/flex|grid/.test(layout) || (css.columnCount !== 'auto' && css.columnCount !== '')) {
          for (const property of ['row-gap', 'column-gap']) {
            const raw = css.getPropertyValue(property);
            if (raw === 'normal') continue;
            const value = round(px(raw));
            if (!onScale(value)) report('gap', property, value);
          }
        }
      }
    }

    if (options.pieces) {
      const content = page ? box(page) : box(root);
      const contentWidth =
        content.width - (page ? px(style(page).paddingLeft) + px(style(page).paddingRight) : 0);
      const padding = (element: Element): string =>
        SIDES.map((side) =>
          Math.round(px(style(element).getPropertyValue(`padding-${side.toLowerCase()}`))),
        ).join(' ');
      const cardLike = (element: Element): boolean => {
        const own = box(element);
        return (
          paints(element) &&
          fill(element) &&
          px(style(element).borderTopLeftRadius) >= 12 &&
          own.width >= 160 &&
          own.height >= 64
        );
      };
      const typed = new Set<Element>();
      const record = (type: PieceType, element: Element, extra = ''): void => {
        typed.add(element);
        pieces.push({ type, element: signature(element), padding: `${padding(element)}${extra}` });
      };
      for (const element of all) {
        const tag = element.tagName;
        if (element.matches('[role="dialog"], dialog, [aria-modal="true"]')) {
          record('dialog', element);
        } else if (element.matches('header.page-heading')) {
          record('banner', element);
        } else if (element.matches('[role="alert"], [role="status"]') && cardLike(element)) {
          record('banner', element);
        } else if ((tag === 'TD' || tag === 'TH') && element.closest('table')) {
          if (!element.closest('tbody tr:not(:first-child)')) record('table-cell', element);
        } else if (element.matches('fieldset, .field, .form-group, .form-field')) {
          const gap = style(element).rowGap;
          record(
            'form-group',
            element,
            gap && gap !== 'normal' ? ` · gap ${Math.round(px(gap))}` : '',
          );
        } else if (element.matches('app-kpi-card > *, .kpi-card')) {
          if (cardLike(element)) record('indicator', element);
        } else if (
          cardLike(element) &&
          element.closest('.page-content') &&
          !element.closest('table')
        ) {
          let nested = false;
          for (let up = element.parentElement; up && up !== page; up = up.parentElement) {
            if (typed.has(up) && cardLike(up)) {
              nested = true;
              break;
            }
          }
          const own = box(element);
          record(nested ? 'sub-card' : own.width >= 0.7 * contentWidth ? 'panel' : 'card', element);
        }
      }
    }

    return { findings, pieces };
  }
}
