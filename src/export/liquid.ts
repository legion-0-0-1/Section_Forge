import type { BNode, Doc } from '../types';
import { tagOf } from '../registry';
import { escapeHtml, slug } from '../lib/util';
import { parseVideo } from '../lib/video';
import { googleFontsHref } from '../lib/fonts';
import { iconSvg } from '../lib/icons';
import { resolveColor } from '../lib/tokens';
import { BREAKPOINTS } from '../lib/style';
import { classAttr, generateCss, type StyleOverrides } from './css';
import { nodeHtml, usedFonts } from './html';
import { childDepthOffset, motionAttrs, rootClasses, wrapChildren } from './structure';
import { motionUsage, needsRuntimeCss, needsRuntimeJs, RUNTIME_JS } from './runtime';

interface Setting {
  type: string;
  id?: string;
  label?: string;
  default?: any;
  [k: string]: any;
}

interface Field {
  type: BNode['type'];
  settingType: string;
  id: string;
  nodeId: string;
}

class Scope {
  settings: Setting[] = [];
  fields: Field[] = [];
  /** block scope: node id -> index among same-type nodes in the template (for preset pairing) */
  occ = new Map<string, number>();
  /** block scope: icon node id -> icon names used by the items at that position */
  iconChoices = new Map<string, string[]>();
  private ids = new Set<string>();
  private labels = new Set<string>();
  constructor(public ref: 'section' | 'block') {}

  uniq(base: string): string {
    let id = slug(base, '_').replace(/[^a-z0-9_]/g, '') || 'setting';
    if (/^\d/.test(id)) id = 's_' + id;
    let out = id;
    let i = 2;
    while (this.ids.has(out)) out = `${id}_${i++}`;
    this.ids.add(out);
    return out;
  }
  label(base: string): string {
    let out = base;
    let i = 2;
    while (this.labels.has(out)) out = `${base} ${i++}`;
    this.labels.add(out);
    return out;
  }
  v(id: string) {
    return `${this.ref}.settings.${id}`;
  }
}

const FIELD_TYPES = new Set<BNode['type']>(['heading', 'text', 'button', 'link', 'image', 'list', 'video']);

const paragraphs = (t: string) =>
  (t || '')
    .split(/\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');

const sq = (s: string) => (s || '').replace(/'/g, "\\'");

/** Coerce a resolved colour string into a form Shopify's `color` setting accepts. */
function toColorDefault(raw: string | undefined, doc: Doc): string | undefined {
  const v = resolveColor(raw || '', doc);
  if (!v) return undefined;
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('').toLowerCase();
  if (/^rgba?\(/i.test(v)) return v; // Shopify accepts rgba() in color defaults
  return undefined;
}

/** Coerce "12px" / "1.5em" / "auto" into a numeric value for a range setting. */
function toNum(raw: string | undefined, fallback = 0): number {
  if (!raw) return fallback;
  const m = /^-?\d*\.?\d+/.exec(String(raw).trim());
  return m ? parseFloat(m[0]) : fallback;
}

export interface LiquidResult {
  code: string;
  filename: string;
  notes: string[];
}

export function generateLiquid(doc: Doc, sectionId: string, opts: { inheritFonts: boolean }): LiquidResult {
  const root = doc.nodes[sectionId];
  const notes = new Set<string>();
  const included = new Set<string>();
  const sectionScope = new Scope('section');
  const blocks: { type: string; name: string; settings: Setting[]; presets: { type: string; settings: Record<string, any> }[] }[] = [];
  const blockTypes = new Set<string>();

  const isField = (n: BNode) => {
    if (!FIELD_TYPES.has(n.type) || n.liquid?.expose === false) return false;
    if (n.type === 'video') {
      const k = parseVideo(n.props.url).kind;
      return k === 'youtube' || k === 'vimeo';
    }
    return true;
  };

  const contentList = (id: string, out: BNode[] = []): BNode[] => {
    const n = doc.nodes[id];
    if (!n) return out;
    if (isField(n)) out.push(n);
    n.children.forEach((c) => contentList(c, out));
    return out;
  };

  const nodesOfType = (rootId: string, type: BNode['type'], out: BNode[] = []): BNode[] => {
    const n = doc.nodes[rootId];
    if (!n) return out;
    if (n.type === type) out.push(n);
    n.children.forEach((c) => nodesOfType(c, type, out));
    return out;
  };

  const markIncluded = (id: string) => {
    included.add(id);
    doc.nodes[id]?.children.forEach(markIncluded);
  };

  const emit = (id: string, depth: number, scope: Scope, extra = ''): string => {
    const n = doc.nodes[id];
    if (!n) return '';
    included.add(id);
    const ind = '  '.repeat(depth);
    const tag = tagOf(n);
    const cls = classAttr(n);
    const attrs = `class="${escapeHtml(rootClasses(n))}"${n.htmlId ? ` id="${escapeHtml(n.htmlId)}"` : ''}${motionAttrs(doc, n, extra.includes('--ss-i'))}${extra ? ' ' + extra : ''}`;
    const baseName = n.liquid?.label || n.name;
    const staticHtml = () => {
      markIncluded(id);
      const h = nodeHtml(doc, id, depth);
      return extra ? h.replace(/^(\s*<[\w-]+) /, `$1 ${extra} `) : h;
    };

    const choices = scope.iconChoices.get(id);
    if (n.type === 'icon' && choices && choices.length > 1 && n.liquid?.expose !== false) {
      const id2 = scope.uniq(baseName);
      scope.settings.push({
        type: 'select',
        id: id2,
        label: scope.label(baseName),
        options: choices.map((c) => ({ value: c, label: c.replace(/([a-z])([A-Z])/g, '$1 $2') })),
        default: choices.includes(n.props.icon) ? n.props.icon : choices[0],
      });
      scope.fields.push({ type: 'icon', settingType: 'select', id: id2, nodeId: id });
      const v = scope.v(id2);
      const size = n.props.size ?? 22;
      const stroke = n.props.stroke ?? 1.75;
      return [
        `${ind}<span ${attrs} aria-hidden="true">`,
        `${ind}  {%- case ${v} -%}`,
        ...choices.flatMap((c) => [`${ind}    {%- when '${c}' -%}`, `${ind}      ${iconSvg(c, size, stroke)}`]),
        `${ind}  {%- endcase -%}`,
        `${ind}</span>`,
      ].join('\n');
    }

    if (!isField(n) && !['section', 'container', 'row', 'grid', 'marquee', 'slider'].includes(n.type)) {
      if (n.type === 'embed') notes.add('Custom HTML blocks are exported as static markup (not editable in the theme editor).');
      return staticHtml();
    }

    switch (n.type) {
      case 'section':
      case 'container':
      case 'row':
      case 'grid':
      case 'marquee':
      case 'slider': {
        const cd = depth + childDepthOffset(n);
        let inner: string;
        if (n.liquid?.blocks && n.children.length && scope.ref === 'section') {
          inner = emitBlocks(n, cd);
        } else {
          if (n.liquid?.blocks && scope.ref === 'block')
            notes.add('Nested repeatable blocks are not supported by Shopify sections — inner block containers were exported as static layout.');
          if (!n.children.length) return `${ind}<${tag} ${attrs}></${tag}>`;
          inner = n.children.map((c) => emit(c, cd, scope)).join('\n');
        }
        return `${ind}<${tag} ${attrs}>\n${wrapChildren(n, depth, inner)}\n${ind}</${tag}>`;
      }
      case 'heading':
      case 'text': {
        const t: string = n.props.text || '';
        const multi = n.type === 'text' && t.includes('\n');
        const st = multi ? 'richtext' : 'inline_richtext';
        const id2 = scope.uniq(baseName);
        const def = multi ? paragraphs(t) : escapeHtml(t);
        scope.settings.push({ type: st, id: id2, label: scope.label(baseName), ...(def ? { default: def } : {}) });
        scope.fields.push({ type: n.type, settingType: st, id: id2, nodeId: id });
        const v = scope.v(id2);
        const outTag = multi ? 'div' : tag;
        return `${ind}{%- if ${v} != blank -%}\n${ind}  <${outTag} ${attrs}>{{ ${v} }}</${outTag}>\n${ind}{%- endif -%}`;
      }
      case 'button':
      case 'link': {
        const lid = scope.uniq(baseName + '_label');
        const uid = scope.uniq(baseName + '_link');
        const lbl = scope.label(baseName);
        const href: string = n.props.href || '#';
        scope.settings.push({ type: 'text', id: lid, label: `${lbl} label`, ...(n.props.text ? { default: n.props.text } : {}) });
        scope.settings.push({
          type: 'url',
          id: uid,
          label: `${lbl} link`,
          ...(href === '/collections' || href === '/collections/all' ? { default: href } : {}),
        });
        scope.fields.push({ type: n.type, settingType: 'text', id: lid, nodeId: id });
        const target = n.props.newTab ? ' target="_blank" rel="noopener"' : '';
        return `${ind}{%- if ${scope.v(lid)} != blank -%}\n${ind}  <a ${attrs} href="{{ ${scope.v(uid)} | default: '${sq(href)}' }}"${target}>{{ ${scope.v(lid)} | escape }}</a>\n${ind}{%- endif -%}`;
      }
      case 'image': {
        const id2 = scope.uniq(baseName);
        scope.settings.push({ type: 'image_picker', id: id2, label: scope.label(baseName) });
        scope.fields.push({ type: 'image', settingType: 'image_picker', id: id2, nodeId: id });
        const v = scope.v(id2);
        const src: string = n.props.src || '';
        const alt = escapeHtml(n.props.alt || '');
        let fallback: string;
        if (/^https?:\/\//.test(src)) fallback = `<img ${attrs} src="${escapeHtml(src)}" alt="${alt}" loading="lazy">`;
        else {
          fallback = `{{ 'lifestyle-1' | placeholder_svg_tag: '${cls} ss-placeholder' }}`;
          if (src.startsWith('data:')) notes.add(`“${n.name}” is an uploaded image — Liquid can’t embed it, so the section shows a placeholder until one is picked in the theme editor.`);
        }
        return [
          `${ind}{%- if ${v} != blank -%}`,
          n.entrance || extra
            ? `${ind}  <img ${attrs} src="{{ ${v} | image_url: width: 1500 }}" srcset="{{ ${v} | image_url: width: 375 }} 375w, {{ ${v} | image_url: width: 750 }} 750w, {{ ${v} | image_url: width: 1100 }} 1100w, {{ ${v} | image_url: width: 1500 }} 1500w, {{ ${v} | image_url: width: 2000 }} 2000w" sizes="(min-width: 990px) 50vw, 100vw" width="{{ ${v}.width }}" height="{{ ${v}.height }}" alt="{{ ${v}.alt | escape }}" loading="lazy">`
            : `${ind}  {{ ${v} | image_url: width: 2000 | image_tag: class: '${cls}', loading: 'lazy', widths: '375, 550, 750, 1100, 1500, 2000', sizes: '(min-width: 990px) 50vw, 100vw' }}`,
          `${ind}{%- else -%}`,
          `${ind}  ${fallback}`,
          `${ind}{%- endif -%}`,
        ].join('\n');
      }
      case 'list': {
        const id2 = scope.uniq(baseName);
        const items: string[] = n.props.items || [];
        scope.settings.push({
          type: 'textarea',
          id: id2,
          label: scope.label(baseName),
          info: 'One item per line',
          ...(items.length ? { default: items.join('\n') } : {}),
        });
        scope.fields.push({ type: 'list', settingType: 'textarea', id: id2, nodeId: id });
        const v = scope.v(id2);
        return [
          `${ind}{%- if ${v} != blank -%}`,
          `${ind}  <${tag} ${attrs}>`,
          `${ind}    {%- assign ss_items = ${v} | newline_to_br | split: '<br />' -%}`,
          `${ind}    {%- for ss_item in ss_items -%}`,
          `${ind}      {%- assign ss_text = ss_item | strip -%}`,
          `${ind}      {%- if ss_text != blank -%}`,
          `${ind}        <li>{{ ss_text | escape }}</li>`,
          `${ind}      {%- endif -%}`,
          `${ind}    {%- endfor -%}`,
          `${ind}  </${tag}>`,
          `${ind}{%- endif -%}`,
        ].join('\n');
      }
      case 'video': {
        const info = parseVideo(n.props.url);
        const id2 = scope.uniq(baseName);
        const def = info.kind === 'youtube' ? `https://www.youtube.com/watch?v=${info.id}` : info.kind === 'vimeo' ? `https://vimeo.com/${info.id}` : undefined;
        scope.settings.push({ type: 'video_url', id: id2, label: scope.label(baseName), accept: ['youtube', 'vimeo'], ...(def ? { default: def } : {}) });
        scope.fields.push({ type: 'video', settingType: 'video_url', id: id2, nodeId: id });
        const v = scope.v(id2);
        const allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        return [
          `${ind}<div ${attrs}>`,
          `${ind}  {%- if ${v} != blank -%}`,
          `${ind}    {%- if ${v}.type == 'youtube' -%}`,
          `${ind}      <iframe src="https://www.youtube.com/embed/{{ ${v}.id }}" title="${escapeHtml(n.name)}" loading="lazy" allow="${allow}" allowfullscreen></iframe>`,
          `${ind}    {%- else -%}`,
          `${ind}      <iframe src="https://player.vimeo.com/video/{{ ${v}.id }}" title="${escapeHtml(n.name)}" loading="lazy" allow="${allow}" allowfullscreen></iframe>`,
          `${ind}    {%- endif -%}`,
          `${ind}  {%- endif -%}`,
          `${ind}</div>`,
        ].join('\n');
      }
      default:
        return staticHtml();
    }
  };

  const emitBlocks = (n: BNode, depth: number): string => {
    const ind = '  '.repeat(depth);
    const tpl = doc.nodes[n.children[0]];
    const nameBase = n.liquid?.blockName || tpl.name;
    let type = slug(nameBase, '_');
    let i = 2;
    while (blockTypes.has(type)) type = `${slug(nameBase, '_')}_${i++}`;
    blockTypes.add(type);

    const scope = new Scope('block');
    const counters: Record<string, number> = {};
    const walkOcc = (id: string) => {
      const x = doc.nodes[id];
      if (!x) return;
      counters[x.type] = (counters[x.type] ?? -1) + 1;
      scope.occ.set(id, counters[x.type]);
      x.children.forEach(walkOcc);
    };
    walkOcc(tpl.id);
    nodesOfType(tpl.id, 'icon').forEach((ic, k) => {
      const used = n.children.map((cid) => nodesOfType(cid, 'icon')[k]?.props.icon).filter(Boolean) as string[];
      scope.iconChoices.set(ic.id, [...new Set(used)]);
    });

    const staggered = !!n.stagger && !!tpl.entrance;
    const inner = emit(tpl.id, depth + 2, scope, '{{ block.shopify_attributes }}' + (staggered ? ' style="--ss-i: {{ forloop.index0 }}"' : ''));

    const presets = n.children.map((cid) => {
      const settings: Record<string, any> = {};
      scope.fields.forEach((f) => {
        const k = scope.occ.get(f.nodeId);
        const c = k === undefined ? undefined : nodesOfType(cid, f.type)[k];
        if (!c) return;
        let val: string | undefined;
        if (f.type === 'heading' || f.type === 'text') {
          const t: string = c.props.text || '';
          val = f.settingType === 'richtext' ? paragraphs(t) : escapeHtml(t.replace(/\n+/g, ' '));
        } else if (f.type === 'button' || f.type === 'link') val = c.props.text;
        else if (f.type === 'list') val = (c.props.items || []).join('\n');
        else if (f.type === 'icon') val = c.props.icon;
        if (val) settings[f.id] = val;
      });
      return { type, settings };
    });
    if (n.children.length > 1) {
      const sig = (id: string) => contentList(id).map((c) => c.type).join(',');
      if (n.children.some((c) => sig(c) !== sig(tpl.id)))
        notes.add(`“${n.name}”: items differ in structure — the first item is used as the block template.`);
    }
    blocks.push({ type, name: nameBase.slice(0, 25), settings: scope.settings, presets });

    return [
      `${ind}{%- for block in section.blocks -%}`,
      `${ind}  {%- if block.type == '${type}' -%}`,
      inner,
      `${ind}  {%- endif -%}`,
      `${ind}{%- endfor -%}`,
    ].join('\n');
  };

  // ---- build --------------------------------------------------------------
  const body = emit(sectionId, 0, sectionScope);
  const usage = motionUsage(doc, [sectionId]);

  // ---- section-level design settings -------------------------------------
  // Each enabled category emits TWO schema settings (desktop + mobile) and a matching
  // CSS override in a `{% style %}` block, so merchants can tune per breakpoint.
  const design = root.liquid?.design || {};
  const useNewDesign = !!(design.background || design.text || design.padding || design.margin);
  // Legacy flags still work for old docs, but the new `design` object takes precedence.
  const useLegacyBg = !useNewDesign && !!root.liquid?.bgSetting;
  const useLegacyPad = !useNewDesign && !!root.liquid?.paddingSettings;

  const designSettings: Setting[] = [];
  const desktopRules: string[] = [];
  const mobileRules: string[] = [];

  const colorDefaults = (prop: 'backgroundColor' | 'color') => {
    const d = toColorDefault(root.styles.desktop[prop], doc);
    const m = toColorDefault(root.styles.mobile?.[prop] ?? root.styles.desktop[prop], doc);
    return { d, m };
  };

  if (design.background || useLegacyBg) {
    const { d, m } = colorDefaults('backgroundColor');
    const idD = 'ss_bg_desktop';
    const idM = 'ss_bg_mobile';
    designSettings.push({ type: 'color', id: idD, label: 'Background colour · desktop', ...(d ? { default: d } : {}) });
    designSettings.push({ type: 'color', id: idM, label: 'Background colour · mobile', ...(m ? { default: m } : {}) });
    desktopRules.push(`background-color: {{ section.settings.${idD} }};`);
    mobileRules.push(`background-color: {{ section.settings.${idM} }};`);
  }

  if (design.text) {
    const { d, m } = colorDefaults('color');
    const idD = 'ss_text_desktop';
    const idM = 'ss_text_mobile';
    designSettings.push({ type: 'color', id: idD, label: 'Text colour · desktop', ...(d ? { default: d } : {}) });
    designSettings.push({ type: 'color', id: idM, label: 'Text colour · mobile', ...(m ? { default: m } : {}) });
    desktopRules.push(`color: {{ section.settings.${idD} }};`);
    mobileRules.push(`color: {{ section.settings.${idM} }};`);
  }

  if (design.padding || useLegacyPad) {
    for (const side of ['Top', 'Bottom'] as const) {
      const prop = `padding${side}`;
      const d = Math.round(toNum(root.styles.desktop[prop], 0));
      const m = Math.round(toNum(root.styles.mobile?.[prop] ?? root.styles.desktop[prop], d));
      const idD = `ss_pad${side.toLowerCase()}_desktop`;
      const idM = `ss_pad${side.toLowerCase()}_mobile`;
      const max = Math.min(400, Math.max(200, Math.ceil(Math.max(d, m) / 4) * 4 + 40));
      designSettings.push({ type: 'range', id: idD, label: `${side} padding · desktop`, min: 0, max, step: 4, unit: 'px', default: d });
      designSettings.push({ type: 'range', id: idM, label: `${side} padding · mobile`, min: 0, max, step: 4, unit: 'px', default: m });
      desktopRules.push(`${prop === 'paddingTop' ? 'padding-top' : 'padding-bottom'}: {{ section.settings.${idD} }}px;`);
      mobileRules.push(`${prop === 'paddingTop' ? 'padding-top' : 'padding-bottom'}: {{ section.settings.${idM} }}px;`);
    }
  }

  if (design.margin) {
    for (const side of ['Top', 'Bottom'] as const) {
      const prop = `margin${side}`;
      const d = Math.round(toNum(root.styles.desktop[prop], 0));
      const m = Math.round(toNum(root.styles.mobile?.[prop] ?? root.styles.desktop[prop], d));
      const idD = `ss_marg${side.toLowerCase()}_desktop`;
      const idM = `ss_marg${side.toLowerCase()}_mobile`;
      const min = -100;
      const max = Math.min(400, Math.max(120, Math.ceil(Math.max(d, m) / 4) * 4 + 40));
      designSettings.push({ type: 'range', id: idD, label: `${side} margin · desktop`, min, max, step: 2, unit: 'px', default: d });
      designSettings.push({ type: 'range', id: idM, label: `${side} margin · mobile`, min, max, step: 2, unit: 'px', default: m });
      desktopRules.push(`${prop === 'marginTop' ? 'margin-top' : 'margin-bottom'}: {{ section.settings.${idD} }}px;`);
      mobileRules.push(`${prop === 'marginTop' ? 'margin-top' : 'margin-bottom'}: {{ section.settings.${idM} }}px;`);
    }
  }

  // Legacy overrides path — used only when the new design block isn't in play.
  const overrides: Record<string, StyleOverrides> = {};
  const ov: StyleOverrides = {};
  if (useLegacyBg) {
    const id = 'background_color';
    const expr = `{{ section.settings.${id} }}`;
    ov.desktop = { ...ov.desktop, backgroundColor: expr };
    if (root.styles.tablet?.backgroundColor) ov.tablet = { ...ov.tablet, backgroundColor: expr };
    if (root.styles.mobile?.backgroundColor) ov.mobile = { ...ov.mobile, backgroundColor: expr };
  }
  if (useLegacyPad) {
    for (const side of ['Top', 'Bottom'] as const) {
      const prop = `padding${side}`;
      const d = parseFloat(root.styles.desktop[prop] || '0') || 0;
      const t = parseFloat(root.styles.tablet?.[prop] ?? root.styles.desktop[prop] ?? '0') || 0;
      const m = parseFloat(root.styles.mobile?.[prop] ?? root.styles.tablet?.[prop] ?? root.styles.desktop[prop] ?? '0') || 0;
      const def = Math.round(d / 4) * 4;
      const id = `padding_${side.toLowerCase()}`;
      const expr = `{{ section.settings.${id} }}px`;
      const ratio = (x: number) => (d ? Math.round((x / d) * 100) / 100 : 1);
      ov.desktop = { ...ov.desktop, [prop]: expr };
      ov.tablet = { ...ov.tablet, [prop]: ratio(t) === 1 ? expr : `calc(${expr} * ${ratio(t)})` };
      ov.mobile = { ...ov.mobile, [prop]: ratio(m) === 1 ? expr : `calc(${expr} * ${ratio(m)})` };
    }
  }
  overrides[root.id] = ov;

  const css = generateCss(doc, [sectionId], {
    scope: '#shopify-section-{{ section.id }}',
    base: 'scoped',
    page: doc.page,
    stripFonts: opts.inheritFonts,
    overrides,
    include: (id) => included.has(id),
    runtime: needsRuntimeCss(usage),
  });

  // ---- schema -------------------------------------------------------------
  const name = (root.liquid?.sectionName || root.name || 'Custom section').slice(0, 25);
  const settings: Setting[] = [...sectionScope.settings];

  if (designSettings.length) {
    settings.push({ type: 'header', content: 'Design' });
    settings.push(...designSettings);
  }

  const schema: Record<string, any> = { name, class: 'ss-section', settings };
  if (blocks.length) schema.blocks = blocks.map((b) => ({ type: b.type, name: b.name, settings: b.settings }));
  schema.presets = [
    {
      name,
      ...(blocks.length
        ? { blocks: blocks.flatMap((b) => b.presets.map((p) => (Object.keys(p.settings).length ? p : { type: p.type }))) }
        : {}),
    },
  ];

  // ---- output -------------------------------------------------------------
  const parts: string[] = [];
  if (!opts.inheritFonts) {
    const href = googleFontsHref(usedFonts(doc, [sectionId]));
    if (href) parts.push(`<link rel="stylesheet" href="${href}">\n`);
  }

  // New section-level design overrides go into their own `{% style %}` block so
  // the generated static CSS stays untouched and merchant overrides layer on top.
  if (desktopRules.length || mobileRules.length) {
    const block = [
      '{%- style -%}',
      `  #shopify-section-{{ section.id }} {`,
      ...desktopRules.map((r) => `    ${r}`),
      `  }`,
      mobileRules.length
        ? [
            `  @media (max-width: ${BREAKPOINTS.mobile}px) {`,
            `    #shopify-section-{{ section.id }} {`,
            ...mobileRules.map((r) => `      ${r}`),
            `    }`,
            `  }`,
          ].join('\n')
        : '',
      '{%- endstyle -%}',
    ]
      .filter(Boolean)
      .join('\n');
    parts.push(block + '\n');
  }

  parts.push(`{%- style -%}\n${css.replace(/^(?=.)/gm, '  ')}{%- endstyle -%}\n`);
  if (needsRuntimeJs(usage)) {
    parts.push(`<script>\n${RUNTIME_JS.trim().replace(/^(?=.)/gm, '  ')}\n</script>\n`);
  }
  parts.push(body + '\n');
  parts.push(`{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}\n`);

  return { code: parts.join('\n'), filename: `${slug(name)}.liquid`, notes: [...notes] };
}