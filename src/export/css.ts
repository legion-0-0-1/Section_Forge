import type { BNode, Doc, PageSettings, Style } from '../types';
import { BREAKPOINTS, kebab } from '../lib/style';
import { slug } from '../lib/util';
import { RUNTIME_CSS } from './runtime';
import { colorTokenVars, textStyleClass, usedTextStyles } from '../lib/tokens';

/** Class attribute value for a node. */
export function classAttr(n: BNode): string {
  const custom = (n.className || '').trim();
  return custom || `ss-${slug(n.name)}-${n.id.slice(0, 4)}`;
}

/** Primary class used as the CSS selector. */
export function classSel(n: BNode): string {
  return classAttr(n).split(/\s+/)[0];
}

export interface StyleOverrides {
  desktop?: Style;
  tablet?: Style;
  mobile?: Style;
}

/** CSS custom properties that drive the motion runtime for this node. */
export function motionVars(n: BNode): { desktop: Style; tablet: Style; mobile: Style } {
  const d: Style = {};
  const t: Style = {};
  const m: Style = {};
  const e = n.entrance;
  if (e) {
    d['--ss-dur'] = e.duration + 'ms';
    d['--ss-delay'] = (e.delay || 0) + 'ms';
    d['--ss-ease'] = e.easing;
    if (e.type.startsWith('slide')) d['--ss-dist'] = e.distance + 'px';
  }
  if (n.stagger) d['--ss-stagger'] = n.stagger + 'ms';
  if (n.type === 'marquee' || n.type === 'slider') {
    if (n.styles.desktop.gap) d['--ss-gap'] = n.styles.desktop.gap;
    if (n.styles.tablet?.gap) t['--ss-gap'] = n.styles.tablet.gap;
    if (n.styles.mobile?.gap) m['--ss-gap'] = n.styles.mobile.gap;
  }
  if (n.type === 'marquee') d['--ss-speed'] = (+n.props.speed || 30) + 's';
  if (n.type === 'slider') {
    const pv = n.props.perView || {};
    d['--ss-per'] = String(pv.desktop ?? 3);
    if (pv.tablet != null && pv.tablet !== pv.desktop) t['--ss-per'] = String(pv.tablet);
    if (pv.mobile != null && pv.mobile !== (pv.tablet ?? pv.desktop)) m['--ss-per'] = String(pv.mobile);
  }
  return { desktop: d, tablet: t, mobile: m };
}

export interface CssOptions {
  /** Selector prefix, e.g. '#shopify-section-{{ section.id }}' */
  scope?: string;
  base: 'page' | 'scoped' | 'none';
  page: PageSettings;
  stripFonts?: boolean;
  overrides?: Record<string, StyleOverrides>;
  include?: (id: string) => boolean;
  /** prepend the motion runtime styles */
  runtime?: boolean;
}

function decls(style: Style, indent: string, stripFonts?: boolean): string[] {
  return Object.entries(style)
    .filter(([k, v]) => v !== '' && v != null && !(stripFonts && k === 'fontFamily'))
    .map(([k, v]) => `${indent}  ${kebab(k)}: ${v};`);
}

function rule(selector: string, style: Style, indent = '', stripFonts?: boolean): string {
  const d = decls(style, indent, stripFonts);
  if (!d.length) return '';
  return `${indent}${selector} {\n${d.join('\n')}\n${indent}}`;
}

export function generateCss(doc: Doc, rootIds: string[], opts: CssOptions): string {
  const pre = opts.scope ? `${opts.scope} ` : '';
  const base: string[] = [];
  const main: string[] = [];
  const tab: string[] = [];
  const mob: string[] = [];
  const hide = { desktop: [] as string[], tablet: [] as string[], mobile: [] as string[] };

  const tokens = colorTokenVars(doc);
  if (opts.base === 'page') {
    const p = opts.page;
    base.push(
      rule(':root', tokens),
      rule('*,\n*::before,\n*::after', { boxSizing: 'border-box' }),
      rule('body', {
        margin: '0',
        ...(opts.stripFonts ? {} : { fontFamily: p.fontFamily }),
        color: p.color,
        backgroundColor: p.background,
        WebkitFontSmoothing: 'antialiased',
      }),
      rule(':where(h1, h2, h3, h4, h5, h6, p, ul, ol, figure, hr, blockquote)', { margin: '0' }),
      rule('img,\nvideo,\niframe', { maxWidth: '100%' }),
    );
  } else if (opts.base === 'scoped') {
    for (const rid of rootIds) {
      const r = doc.nodes[rid];
      const s = `${pre}.${classSel(r)}`;
      base.push(
        rule(`${s},\n${s} *,\n${s} *::before,\n${s} *::after`, { boxSizing: 'border-box' }),
        rule(`${s} :where(h1, h2, h3, h4, h5, h6, p, ul, ol, figure, hr, blockquote)`, { margin: '0' }),
        rule(`${s} :where(img, video, iframe, svg)`, { maxWidth: '100%' }),
        rule(`${s} .ss-placeholder`, { display: 'block', width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.06)' }),
        rule(s, {
          ...tokens,
          ...(opts.stripFonts ? {} : { fontFamily: opts.page.fontFamily }),
          color: opts.page.color,
        }),
      );
    }
  }

  for (const ts of usedTextStyles(doc, rootIds, opts.include)) {
    const sel = `${pre}.${textStyleClass(ts.id)}`;
    main.push(rule(sel, ts.desktop, '', opts.stripFonts));
    if (ts.tablet && Object.keys(ts.tablet).length) tab.push(rule(sel, ts.tablet, '  ', opts.stripFonts));
    if (ts.mobile && Object.keys(ts.mobile).length) mob.push(rule(sel, ts.mobile, '  ', opts.stripFonts));
  }

  const walk = (id: string) => {
    const n = doc.nodes[id];
    if (!n) return;
    if (opts.include && !opts.include(id)) return;
    const sel = `${pre}.${classSel(n)}`;
    const ov = opts.overrides?.[id];
    const mv = motionVars(n);
    main.push(rule(sel, { ...n.styles.desktop, ...mv.desktop, ...ov?.desktop }, '', opts.stripFonts));
    if (n.styles.hover) main.push(rule(`${sel}:hover`, n.styles.hover, '', opts.stripFonts));
    if (n.type === 'video') {
      main.push(
        rule(`${sel} iframe,\n${sel} video`, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          border: '0',
          objectFit: 'cover',
        }),
      );
    }
    const t = { ...n.styles.tablet, ...mv.tablet, ...ov?.tablet };
    const m = { ...n.styles.mobile, ...mv.mobile, ...ov?.mobile };
    if (Object.keys(t).length) tab.push(rule(sel, t, '  ', opts.stripFonts));
    if (Object.keys(m).length) mob.push(rule(sel, m, '  ', opts.stripFonts));
    if (n.hidden?.desktop) hide.desktop.push(sel);
    if (n.hidden?.tablet) hide.tablet.push(sel);
    if (n.hidden?.mobile) hide.mobile.push(sel);
    n.children.forEach(walk);
  };
  rootIds.forEach(walk);

  const out: string[] = [];
  const b = base.filter(Boolean);
  if (b.length) out.push(b.join('\n\n'));
  if (opts.runtime) out.push(RUNTIME_CSS.trim());
  const mm = main.filter(Boolean);
  if (mm.length) out.push(mm.join('\n\n'));

  const media = (q: string, rules: string[]) => {
    const r = rules.filter(Boolean);
    if (r.length) out.push(`@media ${q} {\n${r.join('\n\n')}\n}`);
  };
  media(`(max-width: ${BREAKPOINTS.tablet}px)`, tab);
  media(`(max-width: ${BREAKPOINTS.mobile}px)`, mob);

  const hideRule = (sels: string[]) => (sels.length ? `  ${sels.join(',\n  ')} {\n    display: none !important;\n  }` : '');
  media(`(min-width: ${BREAKPOINTS.tablet + 1}px)`, [hideRule(hide.desktop)]);
  media(`(min-width: ${BREAKPOINTS.mobile + 1}px) and (max-width: ${BREAKPOINTS.tablet}px)`, [hideRule(hide.tablet)]);
  media(`(max-width: ${BREAKPOINTS.mobile}px)`, [hideRule(hide.mobile)]);

  return out.join('\n\n') + '\n';
}
