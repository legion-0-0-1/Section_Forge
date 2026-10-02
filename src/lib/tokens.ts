import type { BNode, Device, Doc, Style, TextStyleToken } from '../types';
import { slug } from './util';

/**
 * Design tokens.
 *  - Colours are CSS custom properties (`var(--ss-c-<id>)`), so editing a token restyles every use.
 *  - Text styles are classes (`.ss-t-<id>`) placed before element rules, so an element's own
 *    values still win — the same cascade the canvas reproduces in `resolveWithTextStyle`.
 */

export const colorVarName = (id: string) => `--ss-c-${slug(id)}`;
export const colorRef = (id: string) => `var(${colorVarName(id)})`;
export const textStyleClass = (id: string) => `ss-t-${slug(id)}`;

const REF = /^var\(--ss-c-([\w-]+)\)$/;

/** id of the colour token a style value points at, if any */
export function tokenIdOf(value: string | undefined): string | null {
  const m = REF.exec((value || '').trim());
  return m ? m[1] : null;
}

export function colorTokenVars(doc: Doc): Style {
  const o: Style = {};
  for (const c of doc.tokens.colors) o[colorVarName(c.id)] = c.value;
  return o;
}

/** Resolve `var(--ss-c-x)` to its hex value for swatches/pickers. */
export function resolveColor(value: string | undefined, doc: Doc): string {
  const id = tokenIdOf(value);
  if (!id) return value || '';
  return doc.tokens.colors.find((c) => slug(c.id) === id)?.value ?? '';
}

export function findTextStyle(doc: Doc, id?: string): TextStyleToken | undefined {
  return id ? doc.tokens.text.find((t) => t.id === id) : undefined;
}

/** Text-style values for a breakpoint (desktop → tablet → mobile cascade). */
export function textStyleFor(ts: TextStyleToken, device: Device): Style {
  return {
    ...ts.desktop,
    ...(device !== 'desktop' ? ts.tablet : {}),
    ...(device === 'mobile' ? ts.mobile : {}),
  };
}

/**
 * Mirrors the exported cascade: [style.d, node.d] then @tablet [style.t, node.t] then @mobile
 * [style.m, node.m] — so an element's desktop override loses to the style's own mobile value,
 * exactly as it would in the browser.
 */
export function resolveWithTextStyle(n: BNode, ts: TextStyleToken | undefined, device: Device, hover: boolean): Style {
  const s: Style = { ...(ts?.desktop || {}), ...n.styles.desktop };
  if (device !== 'desktop') Object.assign(s, ts?.tablet, n.styles.tablet);
  if (device === 'mobile') Object.assign(s, ts?.mobile, n.styles.mobile);
  if (hover && n.styles.hover) Object.assign(s, n.styles.hover);
  return s;
}

export const TYPO_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'fontStyle'];

/** Collect ids of text styles used within the given roots. */
export function usedTextStyles(doc: Doc, rootIds: string[], include?: (id: string) => boolean): TextStyleToken[] {
  const ids = new Set<string>();
  const walk = (id: string) => {
    const n = doc.nodes[id];
    if (!n || (include && !include(id))) return;
    if (n.textStyle) ids.add(n.textStyle);
    n.children.forEach(walk);
  };
  rootIds.forEach(walk);
  return doc.tokens.text.filter((t) => ids.has(t.id));
}
