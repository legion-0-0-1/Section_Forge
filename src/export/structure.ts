import type { BNode, Doc } from '../types';
import { escapeHtml } from '../lib/util';
import { classAttr } from './css';
import { CHEVRON_LEFT, CHEVRON_RIGHT } from './runtime';
import { textStyleClass } from '../lib/tokens';

/**
 * Markup shared by the HTML and Liquid exporters (and mirrored by the canvas), so the wrapper
 * structure of motion elements is defined once.
 */

export function rootClasses(n: BNode): string {
  const base = n.textStyle ? `${classAttr(n)} ${textStyleClass(n.textStyle)}` : classAttr(n);
  if (n.type === 'marquee') return `${base} ss-marquee`;
  if (n.type === 'slider') return `${base} ss-slider`;
  return base;
}

/** Index among the parent's animated children when the parent staggers them (else undefined). */
export function staggerIndex(doc: Doc, n: BNode): number | undefined {
  const p = n.parent ? doc.nodes[n.parent] : null;
  if (!n.entrance || !p?.stagger) return undefined;
  return p.children.filter((c) => doc.nodes[c]?.entrance).indexOf(n.id);
}

/** data-* / style attributes for motion; `skipIndex` when the caller supplies --ss-i itself (Liquid blocks). */
export function motionAttrs(doc: Doc, n: BNode, skipIndex = false): string {
  let a = '';
  if (n.entrance) a += ` data-ss-anim="${escapeHtml(n.entrance.type)}"`;
  if (!skipIndex) {
    const i = staggerIndex(doc, n);
    if (i !== undefined && i > 0) a += ` style="--ss-i: ${i}"`;
  }
  if (n.type === 'marquee') {
    a += ` data-dir="${n.props.direction === 'right' ? 'right' : 'left'}"`;
    if (n.props.pauseOnHover) a += ' data-pause';
  }
  if (n.type === 'slider') {
    if (+n.props.autoplay > 0) a += ` data-autoplay="${+n.props.autoplay}"`;
    if (n.props.loop) a += ' data-loop';
    if (n.props.arrows) a += ' data-arrows';
    if (n.props.dots) a += ' data-dots';
  }
  return a;
}

/** Extra nesting (in indent levels) between a motion container and its children. */
export const childDepthOffset = (n: BNode) => (n.type === 'marquee' || n.type === 'slider' ? 3 : 1);

/** Clone markup for the marquee's second (decorative) copy: no ids, no editor hooks. */
const cloneMarkup = (s: string) => s.replace(/ id="[^"]*"/g, '').replace(/ ?\{\{ block\.shopify_attributes \}\}/g, '');

/**
 * Wrap already-rendered children for container `n` (children were rendered at depth + childDepthOffset).
 * Returns the lines that go between the root open and close tags.
 */
export function wrapChildren(n: BNode, depth: number, inner: string): string {
  const i1 = '  '.repeat(depth + 1);
  const i2 = '  '.repeat(depth + 2);
  if (n.type === 'marquee') {
    // First copy is the real, editable content; repeats (which pad wide screens) and the second
    // half of the loop are decorative clones hidden from assistive tech and the theme editor.
    const copies = Math.max(1, Math.min(6, +n.props.copies || 2));
    const clone = cloneMarkup(inner);
    const dup = `${i2}  <div class="ss-mq-dup" aria-hidden="true">\n${clone}\n${i2}  </div>`;
    const first = [inner, ...Array.from({ length: copies - 1 }, () => dup)].join('\n');
    const second = Array.from({ length: copies }, () => clone).join('\n');
    return [
      `${i1}<div class="ss-mq-track">`,
      `${i2}<div class="ss-mq-group">`,
      first,
      `${i2}</div>`,
      `${i2}<div class="ss-mq-group" aria-hidden="true">`,
      second,
      `${i2}</div>`,
      `${i1}</div>`,
    ].join('\n');
  }
  if (n.type === 'slider') {
    return [
      `${i1}<div class="ss-slider-viewport">`,
      `${i2}<div class="ss-slider-track">`,
      inner,
      `${i2}</div>`,
      `${i2}<button type="button" class="ss-slider-btn ss-prev" aria-label="Previous slide">${CHEVRON_LEFT}</button>`,
      `${i2}<button type="button" class="ss-slider-btn ss-next" aria-label="Next slide">${CHEVRON_RIGHT}</button>`,
      `${i1}</div>`,
      `${i1}<div class="ss-slider-dots" role="group" aria-label="Choose slide"></div>`,
    ].join('\n');
  }
  return inner;
}
