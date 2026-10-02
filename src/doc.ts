import type { BNode, Doc, LiquidOptions, NodeStyles, EntranceAnim, PageSettings, Style, Tokens, TreeSpec, ElementType, Device } from './types';
import { ELEMENTS } from './registry';
import { uid } from './lib/util';

/** Standard centered content wrapper used inside sections. */
export const WRAP: Style = {
  width: '100%',
  maxWidth: '1200px',
  marginLeft: 'auto',
  marginRight: 'auto',
  gap: '24px',
};

export const DEFAULT_PAGE: PageSettings = {
  title: 'My landing page',
  fontFamily: "'Inter', system-ui, sans-serif",
  color: '#0f172a',
  background: '#ffffff',
};

const clean = (s?: Style): Style => {
  const o: Style = {};
  if (s) for (const k in s) if (s[k] !== '' && s[k] != null) o[k] = s[k];
  return o;
};

export interface ElOpts {
  name?: string;
  props?: Record<string, any>;
  style?: Style;
  tablet?: Style;
  mobile?: Style;
  hover?: Style;
  liquid?: LiquidOptions;
  entrance?: EntranceAnim;
  stagger?: number;
  textStyle?: string;
  hidden?: Partial<Record<Device, boolean>>;
}

/** Build a spec for an element, merging the registry defaults. Pass '' to drop a default. */
export function el(type: ElementType, o: ElOpts = {}, children: TreeSpec[] = []): TreeSpec {
  const d = ELEMENTS[type];
  return {
    type,
    name: o.name,
    props: { ...structuredClone(d.props), ...(o.props || {}) },
    style: clean({ ...d.style, ...o.style }),
    tablet: clean({ ...d.tablet, ...o.tablet }),
    mobile: clean({ ...d.mobile, ...o.mobile }),
    hover: clean({ ...d.hover, ...o.hover }),
    liquid: o.liquid,
    entrance: o.entrance,
    stagger: o.stagger,
    textStyle: o.textStyle,
    hidden: o.hidden,
    children,
  };
}

export function wrapSpec(child?: TreeSpec): TreeSpec {
  return el('section', {}, [el('container', { name: 'Wrapper', style: WRAP }, child ? [child] : [])]);
}

export function instantiate(spec: TreeSpec, parent: string | null, out: Record<string, BNode>): string {
  const id = uid();
  const styles: NodeStyles = { desktop: { ...spec.style } };
  if (Object.keys(spec.tablet).length) styles.tablet = { ...spec.tablet };
  if (Object.keys(spec.mobile).length) styles.mobile = { ...spec.mobile };
  if (Object.keys(spec.hover).length) styles.hover = { ...spec.hover };
  const node: BNode = {
    id,
    type: spec.type,
    name: spec.name || ELEMENTS[spec.type].label,
    props: structuredClone(spec.props),
    styles,
    children: [],
    parent,
  };
  if (spec.liquid) node.liquid = { ...spec.liquid };
  if (spec.hidden && Object.values(spec.hidden).some(Boolean)) node.hidden = { ...spec.hidden };
  if (spec.textStyle) node.textStyle = spec.textStyle;
  if (spec.entrance) node.entrance = { ...spec.entrance };
  if (spec.stagger) node.stagger = spec.stagger;
  out[id] = node;
  node.children = spec.children.map((c) => instantiate(c, id, out));
  return id;
}

export function specFromSubtree(nodes: Record<string, BNode>, id: string): TreeSpec {
  const n = nodes[id];
  return {
    type: n.type,
    name: n.name,
    props: structuredClone(n.props),
    style: { ...n.styles.desktop },
    tablet: { ...(n.styles.tablet || {}) },
    mobile: { ...(n.styles.mobile || {}) },
    hover: { ...(n.styles.hover || {}) },
    liquid: n.liquid ? { ...n.liquid } : undefined,
    hidden: n.hidden ? { ...n.hidden } : undefined,
    textStyle: n.textStyle,
    entrance: n.entrance ? { ...n.entrance } : undefined,
    stagger: n.stagger,
    children: n.children.map((c) => specFromSubtree(nodes, c)),
  };
}

export function attachAt(d: Doc, id: string, parentId: string | null, index: number) {
  const arr = parentId ? d.nodes[parentId].children : d.roots;
  const i = Math.max(0, Math.min(index, arr.length));
  arr.splice(i, 0, id);
  d.nodes[id].parent = parentId;
}

export function detach(d: Doc, id: string) {
  const n = d.nodes[id];
  if (!n) return;
  if (n.parent) {
    const p = d.nodes[n.parent];
    p.children = p.children.filter((c) => c !== id);
  } else {
    d.roots = d.roots.filter((r) => r !== id);
  }
}

export function removeSubtree(d: Doc, id: string) {
  const n = d.nodes[id];
  if (!n) return;
  n.children.forEach((c) => removeSubtree(d, c));
  delete d.nodes[id];
}

/** true if `a` is `b` or one of b's ancestors */
export function isAncestorOrSelf(d: Doc, a: string, b: string): boolean {
  let cur: string | null = b;
  while (cur) {
    if (cur === a) return true;
    cur = d.nodes[cur]?.parent ?? null;
  }
  return false;
}

export function rootOf(d: Doc, id: string): string {
  let cur = id;
  while (d.nodes[cur]?.parent) cur = d.nodes[cur].parent!;
  return cur;
}

/** Sections can only live at the root, and the root only holds sections. */
export const isRootOnly = (t: ElementType) => t === 'section';

/**
 * Single source of truth for where a node of `type` may go when targeted at (parentId, index):
 * sections dropped inside something land after that section's root; anything else dropped at
 * the root is wrapped in a new section.
 */
export function normalizeTarget(
  d: Doc,
  type: ElementType,
  parentId: string | null,
  index: number,
): { parentId: string | null; index: number; wrap: boolean } {
  if (isRootOnly(type) && parentId !== null) {
    return { parentId: null, index: d.roots.indexOf(rootOf(d, parentId)) + 1, wrap: false };
  }
  return { parentId, index, wrap: parentId === null && !isRootOnly(type) };
}

export function siblingsOf(d: Doc, id: string): string[] {
  const n = d.nodes[id];
  return n.parent ? d.nodes[n.parent].children : d.roots;
}

/** Starter design tokens for new projects. */
export function defaultTokens(): Tokens {
  return {
    colors: [
      { id: 'ink', name: 'Ink', value: '#0f172a' },
      { id: 'muted', name: 'Muted', value: '#475569' },
      { id: 'brand', name: 'Brand', value: '#4f46e5' },
      { id: 'surface', name: 'Surface', value: '#ffffff' },
      { id: 'tint', name: 'Tint', value: '#f8fafc' },
    ],
    text: [
      { id: 'display', name: 'Display', desktop: { fontSize: '56px', fontWeight: '700', lineHeight: '1.05', letterSpacing: '-0.03em' }, tablet: { fontSize: '46px' }, mobile: { fontSize: '36px' } },
      { id: 'heading', name: 'Heading', desktop: { fontSize: '40px', fontWeight: '700', lineHeight: '1.15', letterSpacing: '-0.02em' }, tablet: { fontSize: '34px' }, mobile: { fontSize: '28px' } },
      { id: 'body', name: 'Body', desktop: { fontSize: '17px', fontWeight: '400', lineHeight: '1.65' }, mobile: { fontSize: '16px' } },
      { id: 'eyebrow', name: 'Eyebrow', desktop: { fontSize: '13px', fontWeight: '700', lineHeight: '1.4', letterSpacing: '0.12em', textTransform: 'uppercase' } },
    ],
  };
}

export function emptyDoc(name = 'Untitled project'): Doc {
  const now = Date.now();
  return { version: 2, id: uid(), name, createdAt: now, updatedAt: now, nodes: {}, roots: [], page: { ...DEFAULT_PAGE }, tokens: defaultTokens() };
}

export function docFromSpecs(specs: TreeSpec[], name = 'Untitled project', page?: Partial<PageSettings>): Doc {
  const d = emptyDoc(name);
  Object.assign(d.page, page);
  for (const s of specs) {
    const id = instantiate(s.type === 'section' ? s : wrapSpec(s), null, d.nodes);
    d.roots.push(id);
  }
  return d;
}

export const DEVICES: Device[] = ['desktop', 'tablet', 'mobile'];
