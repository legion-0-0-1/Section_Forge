/** Tiny purpose-built highlighter for the markup we generate (HTML, CSS, Liquid, JSON). */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const span = (cls: string, s: string) => (s ? `<span class="tk-${cls}">${esc(s)}</span>` : '');

const LQ_KEYWORDS =
  /^(if|else|elsif|endif|for|endfor|in|assign|unless|endunless|case|when|endcase|and|or|contains|blank|empty|comment|endcomment|style|endstyle|schema|endschema|render|raw|endraw|capture|endcapture|form|endform)$/;

function liquidTag(tag: string): string {
  const m = /^(\{[{%]-?)([\s\S]*?)(-?[}%]\})$/.exec(tag);
  if (!m) return span('lq', tag);
  let inner = '';
  const re = /('[^']*'|"[^"]*")|(\|)|([A-Za-z_][\w.-]*)|(\d+)|(\s+|.)/g;
  let t: RegExpExecArray | null;
  let afterPipe = false;
  while ((t = re.exec(m[2]))) {
    if (t[1]) inner += span('str', t[1]);
    else if (t[2]) {
      inner += span('lq-d', '|');
      afterPipe = true;
      continue;
    } else if (t[3]) inner += span(afterPipe ? 'lq-f' : LQ_KEYWORDS.test(t[3]) ? 'kw' : 'lq-v', t[3]);
    else if (t[4]) inner += span('num', t[4]);
    else inner += esc(t[5]);
    if (t[3] || t[1]) afterPipe = false;
  }
  return span('lq-d', m[1]) + inner + span('lq-d', m[3]);
}

function withLiquid(s: string, cls: string): string {
  return s
    .split(/(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\})/)
    .map((p, i) => (i % 2 ? liquidTag(p) : span(cls, p)))
    .join('');
}

export function highlightCss(src: string): string {
  return src
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      const lead = line.slice(0, line.length - line.trimStart().length);
      if (t.startsWith('/*')) return span('comment', line);
      if (t === '}') return lead + span('punct', '}');
      if (t.endsWith('{')) {
        const body = t.slice(0, -1);
        if (body.startsWith('@')) {
          const [kw, ...rest] = body.split(' ');
          return lead + span('kw', kw) + ' ' + withLiquid(rest.join(' '), 'val') + span('punct', '{');
        }
        return lead + withLiquid(body, 'sel') + span('punct', '{');
      }
      const m = /^([\w-]+)(\s*:\s*)(.*?)(;?)$/.exec(t);
      if (m) return lead + span('prop', m[1]) + esc(m[2]) + withLiquid(m[3], 'val') + span('punct', m[4]);
      if (t.endsWith(',')) return lead + withLiquid(t, 'sel');
      return withLiquid(line, 'txt');
    })
    .join('\n');
}

export function highlightJson(src: string): string {
  let out = '';
  let last = 0;
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    if (m[1]) out += m[2] ? span('prop', m[1]) + esc(m[2]) : span('str', m[1]);
    else if (m[3]) out += span('kw', m[3]);
    else out += span('num', m[4]);
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}

export function highlightMarkup(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  let inTag = false;
  let tagName = '';
  let closing = false;

  const findEndTag = (re: RegExp, from: number) => {
    re.lastIndex = from;
    const m = re.exec(src);
    return m ? m.index : n;
  };

  while (i < n) {
    const c = src[i];
    // Liquid
    if (c === '{' && (src[i + 1] === '{' || src[i + 1] === '%')) {
      const close = src[i + 1] === '{' ? '}}' : '%}';
      const j = src.indexOf(close, i + 2);
      const end = j < 0 ? n : j + 2;
      const tag = src.slice(i, end);
      out += liquidTag(tag);
      i = end;
      if (!inTag && /^\{%-?\s*schema\b/.test(tag)) {
        const k = findEndTag(/\{%-?\s*endschema/g, i);
        out += highlightJson(src.slice(i, k));
        i = k;
      } else if (!inTag && /^\{%-?\s*style\b/.test(tag)) {
        const k = findEndTag(/\{%-?\s*endstyle/g, i);
        out += highlightCss(src.slice(i, k));
        i = k;
      }
      continue;
    }
    if (!inTag) {
      if (src.startsWith('<!--', i)) {
        const j = src.indexOf('-->', i);
        const end = j < 0 ? n : j + 3;
        out += span('comment', src.slice(i, end));
        i = end;
        continue;
      }
      if (src.startsWith('<!', i)) {
        const j = src.indexOf('>', i);
        const end = j < 0 ? n : j + 1;
        out += span('meta', src.slice(i, end));
        i = end;
        continue;
      }
      const m = c === '<' ? /^<(\/?)([a-zA-Z][\w-]*)/.exec(src.slice(i, i + 64)) : null;
      if (m) {
        out += span('punct', '<' + m[1]) + span('tag', m[2]);
        tagName = m[2].toLowerCase();
        closing = !!m[1];
        inTag = true;
        i += m[0].length;
        continue;
      }
      let j = i + 1;
      while (j < n && src[j] !== '<' && src[j] !== '{') j++;
      out += esc(src.slice(i, j));
      i = j;
      continue;
    }
    // inside a tag
    if (c === '>' || src.startsWith('/>', i)) {
      const tok = c === '>' ? '>' : '/>';
      out += span('punct', tok);
      i += tok.length;
      inTag = false;
      if (!closing && tagName === 'style' && tok === '>') {
        const k = findEndTag(/<\/style/gi, i);
        out += highlightCss(src.slice(i, k));
        i = k;
      } else if (!closing && tagName === 'script' && tok === '>') {
        const k = findEndTag(/<\/script/gi, i);
        out += esc(src.slice(i, k));
        i = k;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '{' && (src[j + 1] === '{' || src[j + 1] === '%')) {
          const close = src[j + 1] === '{' ? '}}' : '%}';
          const k = src.indexOf(close, j + 2);
          j = k < 0 ? n : k + 2;
        } else j++;
      }
      out += withLiquid(src.slice(i, j + 1), 'str');
      i = j + 1;
      continue;
    }
    const am = /^[^\s=>"'/{]+/.exec(src.slice(i, i + 64));
    if (am) {
      out += span('attr', am[0]);
      i += am[0].length;
      continue;
    }
    out += esc(c);
    i++;
  }
  return out;
}

export function highlight(code: string, lang: 'html' | 'css' | 'liquid' | 'json'): string {
  if (lang === 'css') return highlightCss(code);
  if (lang === 'json') return highlightJson(code);
  return highlightMarkup(code);
}
