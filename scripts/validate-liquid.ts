import { Liquid, Tag, type TagToken, type TopLevelToken, type Context, type Emitter } from 'liquidjs';
import { demoDoc } from '../src/templates';
import { TEMPLATES } from '../src/templates';
import { docFromSpecs } from '../src/doc';
import { generateLiquid } from '../src/export/liquid';
import { exportHtml } from '../src/export/html';
import { inspectFile, withMarker } from '../src/export/markers';

const engine = new Liquid({ strictVariables: false, strictFilters: true });
// Shopify-specific tags/filters stubbed for validation
for (const name of ['schema', 'style']) {
  engine.registerTag(name, class extends Tag {
    tpls: any[] = [];
    raw = '';
    constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
      super(token, remain, liquid);
      const stream = this.liquid.parser.parseStream(remain);
      stream.on(`tag:end${name}`, () => stream.stop()).on('template', (t: any) => this.tpls.push(t)).on('end', () => { throw new Error(`${name} not closed`); });
      stream.start();
    }
    *render(ctx: Context, emitter: Emitter): any {
      if (name === 'style') { emitter.write('<style>'); yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter); emitter.write('</style>'); }
    }
  });
}
engine.registerFilter('image_url', (v: any) => v?.src ?? '');
engine.registerFilter('image_tag', (v: any) => `<img src="${v}">`);
engine.registerFilter('placeholder_svg_tag', (_v: any, cls: string) => `<svg class="${cls}"></svg>`);

let fail = 0;
const docs = [demoDoc(), docFromSpecs(TEMPLATES.map((t) => t.spec()))];
for (const doc of docs) {
  for (const id of doc.roots) {
    const r = generateLiquid(doc, id, { inheritFonts: true });
    const schemaTxt = /\{% schema %\}([\s\S]*?)\{% endschema %\}/.exec(r.code)![1];
    let schema: any;
    try { schema = JSON.parse(schemaTxt); } catch (e) { console.log('BAD JSON', r.filename); fail++; continue; }
    // basic Shopify schema rules
    const ids = new Set<string>();
    for (const s of schema.settings) {
      if (s.type === 'header') continue;
      if (!/^[a-z0-9_]+$/.test(s.id)) { console.log('bad id', s.id); fail++; }
      if (ids.has(s.id)) { console.log('dup id', s.id); fail++; }
      ids.add(s.id);
      if (s.type === 'url' && s.default && !['/collections', '/collections/all'].includes(s.default)) { console.log('bad url default'); fail++; }
      if (s.type === 'range' && (s.default % s.step !== 0 || (s.max - s.min) / s.step > 101)) { console.log('bad range', s); fail++; }
    }
    if (schema.name.length > 25) { console.log('name too long', schema.name); fail++; }
    const settings = Object.fromEntries(schema.settings.filter((s: any) => s.id).map((s: any) => [s.id, s.default ?? '']));
    const blocks = (schema.presets[0].blocks || []).map((b: any, i: number) => {
      const def = schema.blocks.find((d: any) => d.type === b.type);
      const bs = Object.fromEntries(def.settings.map((s: any) => [s.id, s.default ?? '']));
      return { type: b.type, id: 'b' + i, shopify_attributes: `data-block="${i}"`, settings: { ...bs, ...b.settings } };
    });
    try {
      const html = await engine.parseAndRender(r.code, { section: { id: 'x', settings, blocks } });
      const blockCount = (html.match(/data-block=/g) || []).length;
      console.log(`OK  ${r.filename.padEnd(24)} settings=${schema.settings.length} blocks=${blocks.length} rendered=${blockCount} html=${html.length}b${r.notes.length ? ' notes=' + r.notes.length : ''}`);
      if (blockCount !== blocks.length) { console.log('   block render mismatch'); fail++; }
      if (/\{\{|\{%/.test(html)) { console.log('   unrendered liquid left'); fail++; }
      // motion runtime: present exactly when needed, and syntactically valid ES5
      const needsJs = /<[a-z][^>]* data-ss-anim="|<[a-z][^>]* class="[^"]*\bss-slider\b/.test(html);
      const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      if (needsJs !== scripts.some((s) => s.includes('SectionForgeRuntime'))) { console.log('   runtime script missing/unneeded'); fail++; }
      for (const js of scripts) {
        try { new Function(js); } catch (e: any) { console.log('   runtime JS syntax error:', e.message); fail++; }
      }
      if (/ss-marquee|data-ss-anim|ss-slider/.test(html) && !/ss-mq-track|ss-js/.test(html)) { console.log('   runtime CSS missing'); fail++; }
    } catch (e: any) { console.log('RENDER FAIL', r.filename, e.message); fail++; }
  }
}
// ---- generated-file markers: still valid Liquid, and round-trip detection works
{
  const doc = docs[0];
  const code = generateLiquid(doc, doc.roots[1], { inheritFonts: true }).code;
  const marked = withMarker(code, 'liquid', 'test');
  try {
    await engine.parse(marked);
  } catch (e: any) { console.log('marked liquid fails to parse:', e.message); fail++; }
  const same = inspectFile(marked, code);
  const edited = inspectFile(marked.replace('{% schema %}', '<p>hand edit</p>\n{% schema %}'), code);
  const bare = inspectFile(code, code);
  const html = exportHtml(doc, doc.roots, { fullDocument: true, inlineCss: true });
  const markedHtml = withMarker(html, 'html', 'test');
  const ok =
    same.status === 'unchanged' && same.vsCurrent === 0 &&
    edited.status === 'edited' &&
    bare.status === 'unmarked' &&
    markedHtml.startsWith('<!DOCTYPE html>') && inspectFile(markedHtml, html).status === 'unchanged';
  console.log(ok ? 'OK  markers: unchanged / edited / unmarked detected' : `MARKERS FAIL ${JSON.stringify({ same, edited, bare })}`);
  if (!ok) fail++;
}
console.log(fail ? `FAILURES: ${fail}` : 'ALL PASSED');
if (fail) process.exitCode = 1;
