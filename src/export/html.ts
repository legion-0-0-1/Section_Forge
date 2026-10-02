import type { Doc } from '../types';
import { tagOf } from '../registry';
import { escapeHtml } from '../lib/util';
import { iconSvg } from '../lib/icons';
import { parseVideo } from '../lib/video';
import { fontNameFromStack, googleFontsHref } from '../lib/fonts';
import { generateCss } from './css';
import { childDepthOffset, motionAttrs, rootClasses, wrapChildren } from './structure';
import { motionUsage, needsRuntimeCss, needsRuntimeJs, RUNTIME_JS } from './runtime';

export const textToHtml = (t: string) => escapeHtml(t ?? '').replace(/\n/g, '<br>');

export function nodeHtml(doc: Doc, id: string, depth = 0): string {
  const n = doc.nodes[id];
  if (!n) return '';
  const ind = '  '.repeat(depth);
  const tag = tagOf(n);
  let a = `class="${escapeHtml(rootClasses(n))}"`;
  if (n.htmlId) a += ` id="${escapeHtml(n.htmlId)}"`;
  a += motionAttrs(doc, n);

  switch (n.type) {
    case 'section':
    case 'container':
    case 'row':
    case 'grid':
    case 'marquee':
    case 'slider': {
      if (!n.children.length) return `${ind}<${tag} ${a}></${tag}>`;
      const inner = n.children.map((c) => nodeHtml(doc, c, depth + childDepthOffset(n))).join('\n');
      return `${ind}<${tag} ${a}>\n${wrapChildren(n, depth, inner)}\n${ind}</${tag}>`;
    }
    case 'heading':
    case 'text':
      return `${ind}<${tag} ${a}>${textToHtml(n.props.text)}</${tag}>`;
    case 'button':
    case 'link': {
      const target = n.props.newTab ? ' target="_blank" rel="noopener"' : '';
      return `${ind}<a ${a} href="${escapeHtml(n.props.href || '#')}"${target}>${textToHtml(n.props.text)}</a>`;
    }
    case 'list': {
      const items: string[] = n.props.items || [];
      return `${ind}<${tag} ${a}>\n${items.map((it) => `${ind}  <li>${escapeHtml(it)}</li>`).join('\n')}\n${ind}</${tag}>`;
    }
    case 'icon':
      return `${ind}<span ${a} aria-hidden="true">${iconSvg(n.props.icon, n.props.size ?? 22, n.props.stroke ?? 1.75)}</span>`;
    case 'image':
      return `${ind}<img ${a} src="${escapeHtml(n.props.src || '')}" alt="${escapeHtml(n.props.alt || '')}" loading="lazy">`;
    case 'video': {
      const v = parseVideo(n.props.url);
      let inner = '';
      if (v.kind === 'youtube' || v.kind === 'vimeo')
        inner = `<iframe src="${v.embed}" title="${escapeHtml(n.name)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      else if (v.kind === 'file') inner = `<video src="${escapeHtml(v.src)}" controls playsinline preload="metadata"></video>`;
      return `${ind}<div ${a}>\n${ind}  ${inner}\n${ind}</div>`;
    }
    case 'embed':
      return `${ind}<div ${a}>\n${(n.props.html || '')
        .split('\n')
        .map((l: string) => ind + '  ' + l)
        .join('\n')}\n${ind}</div>`;
    case 'divider':
      return `${ind}<hr ${a}>`;
    case 'spacer':
      return `${ind}<div ${a} aria-hidden="true"></div>`;
  }
}

/** Google font families used by the page and any nodes in the given roots. */
export function usedFonts(doc: Doc, rootIds: string[]): string[] {
  const names = new Set<string>([fontNameFromStack(doc.page.fontFamily)]);
  const addStyle = (s?: Record<string, string>) => s?.fontFamily && names.add(fontNameFromStack(s.fontFamily));
  const walk = (id: string) => {
    const n = doc.nodes[id];
    if (!n) return;
    [n.styles.desktop, n.styles.tablet, n.styles.mobile, n.styles.hover].forEach(addStyle);
    const ts = n.textStyle ? doc.tokens.text.find((t) => t.id === n.textStyle) : undefined;
    if (ts) [ts.desktop, ts.tablet, ts.mobile].forEach(addStyle);
    n.children.forEach(walk);
  };
  rootIds.forEach(walk);
  return [...names];
}

export interface HtmlOptions {
  fullDocument: boolean;
  inlineCss: boolean;
}

export function exportCss(doc: Doc, rootIds: string[]): string {
  return generateCss(doc, rootIds, { base: 'page', page: doc.page, runtime: needsRuntimeCss(motionUsage(doc, rootIds)) });
}

const script = (js: string, ind: string) =>
  `${ind}<script>\n${js
    .trim()
    .split('\n')
    .map((l) => (l ? ind + '  ' + l : l))
    .join('\n')}\n${ind}</script>`;

export function exportHtml(doc: Doc, rootIds: string[], opts: HtmlOptions): string {
  const body = rootIds.map((id) => nodeHtml(doc, id, opts.fullDocument ? 1 : 0)).join('\n\n');
  const js = needsRuntimeJs(motionUsage(doc, rootIds));
  if (!opts.fullDocument) {
    const parts: string[] = [];
    if (opts.inlineCss) parts.push(`<style>\n${exportCss(doc, rootIds)}</style>`);
    parts.push(body);
    if (js) parts.push(script(RUNTIME_JS, ''));
    return parts.join('\n\n') + '\n';
  }
  const fonts = googleFontsHref(usedFonts(doc, rootIds));
  const head = [
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(doc.page.title || doc.name)}</title>`,
  ];
  if (fonts) {
    head.push(
      '  <link rel="preconnect" href="https://fonts.googleapis.com">',
      '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      `  <link rel="stylesheet" href="${fonts}">`,
    );
  }
  if (opts.inlineCss) {
    const css = exportCss(doc, rootIds)
      .split('\n')
      .map((l) => (l ? '    ' + l : l))
      .join('\n');
    head.push(`  <style>\n${css}  </style>`);
  } else head.push('  <link rel="stylesheet" href="styles.css">');
  // flag JS early so entrance animations start hidden instead of flashing
  if (js) head.push("  <script>document.documentElement.classList.add('ss-js')</script>");

  const tail = js ? `\n${script(RUNTIME_JS, '  ')}` : '';
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n${head.join('\n')}\n</head>\n<body>\n${body}${tail}\n</body>\n</html>\n`;
}
