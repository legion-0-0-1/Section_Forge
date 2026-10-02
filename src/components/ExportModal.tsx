import { useMemo, useRef, useState } from 'react';
import { inspectFile, withMarker, type FileCheck } from '../export/markers';
import { AlertTriangle, Check, CheckCircle2, Copy, Download, FileArchive, FileCode2, FileSearch, Info, ShoppingBag, X } from 'lucide-react';
import { useStore } from '../store';
import { exportCss, exportHtml } from '../export/html';
import { generateLiquid } from '../export/liquid';
import { highlight } from '../lib/highlight';
import { copyText, downloadBlob, downloadText, slug } from '../lib/util';
import { Switch } from './controls';

type Tab = 'html' | 'css' | 'liquid';
type ExportKind = 'export-liquid' | 'export-html' | 'export-css';
const st = () => useStore.getState();

/** All three export modal variants — one per format. */
const isExportKind = (m: ReturnType<typeof st>['modal']): m is ExportKind =>
  m === 'export-liquid' || m === 'export-html' || m === 'export-css';

const tabToKind = (t: Tab): ExportKind => (t === 'html' ? 'export-html' : t === 'css' ? 'export-css' : 'export-liquid');
const kindToTab = (k: ExportKind): Tab => (k === 'export-html' ? 'html' : k === 'export-css' ? 'css' : 'liquid');

export function CodeView({ code, lang }: { code: string; lang: 'html' | 'css' | 'liquid' | 'json' }) {
  const html = useMemo(() => highlight(code, lang), [code, lang]);
  const lineCount = useMemo(() => code.split('\n').length, [code]);
  return (
    <div className="code">
      <div className="code-gutter" aria-hidden>
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}

export function ExportModal() {
  const doc = useStore((s) => s.doc);
  const selectedId = useStore((s) => s.selectedId);
  const modal = useStore((s) => s.modal);
  const lastExportKind = useStore((s) => s.lastExportKind);
  const setLastExportKind = useStore((s) => s.setLastExportKind);
  const selRoot = useMemo(() => {
    let cur = selectedId;
    while (cur && doc.nodes[cur]?.parent) cur = doc.nodes[cur].parent;
    return cur && doc.roots.includes(cur) ? cur : null;
  }, [selectedId, doc]);

  // The dropdown's explicit choice wins; otherwise fall back to the last-used format.
  const [tab, setTabState] = useState<Tab>(() =>
    isExportKind(modal) ? kindToTab(modal) : kindToTab(lastExportKind),
  );
  /** Switch tab and remember it — both for this session's modal and for next open. */
  const setTab = (t: Tab) => {
    setTabState(t);
    const k = tabToKind(t);
    if (k !== lastExportKind) setLastExportKind(k);
  };

  const [scope, setScope] = useState<string>(selRoot ?? 'all');
  const [liquidSection, setLiquidSection] = useState<string>(selRoot ?? doc.roots[0] ?? '');
  const [fullDoc, setFullDoc] = useState(true);
  const [inlineCss, setInlineCss] = useState(false);
  const [inheritFonts, setInheritFonts] = useState(true);
  const [copied, setCopied] = useState(false);
  const [markers, setMarkers] = useState(true);
  const [check, setCheck] = useState<{ name: string; result: FileCheck } | null>(null);
  const checkRef = useRef<HTMLInputElement>(null);

  const rootIds = scope === 'all' ? doc.roots : [scope];

  const gen = useMemo(() => {
    if (!doc.roots.length) return { code: '', filename: '', notes: [] as string[], lang: 'html' as const };
    if (tab === 'html') {
      const code = exportHtml(doc, rootIds, { fullDocument: fullDoc, inlineCss });
      const uploads = code.match(/src="data:image\/[^"]+"/g) || [];
      const notes = uploads.length
        ? [`${uploads.length} uploaded image${uploads.length > 1 ? 's are' : ' is'} embedded as base64 (+${Math.round(uploads.join('').length / 1024)} KB). Host them and use URLs for faster pages.`]
        : [];
      return { code, filename: fullDoc ? 'index.html' : `${slug(doc.nodes[rootIds[0]]?.name || 'section')}.html`, notes, lang: 'html' as const };
    }
    if (tab === 'css') return { code: exportCss(doc, rootIds), filename: 'styles.css', notes: [], lang: 'css' as const };
    const sid = doc.nodes[liquidSection] ? liquidSection : doc.roots[0];
    const r = generateLiquid(doc, sid, { inheritFonts });
    return { ...r, lang: 'liquid' as const };
  }, [doc, tab, scope, fullDoc, inlineCss, liquidSection, inheritFonts]);

  const source = (sectionId?: string) =>
    `project “${doc.name}”${sectionId && doc.nodes[sectionId] ? `, section “${doc.nodes[sectionId].liquid?.sectionName || doc.nodes[sectionId].name}”` : ''}`;
  const out = useMemo(() => {
    if (!markers || !gen.code) return gen;
    const sid = tab === 'liquid' ? liquidSection : scope !== 'all' ? scope : undefined;
    return { ...gen, code: withMarker(gen.code, tab, source(sid)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, markers]);

  const copy = async () => {
    if (await copyText(out.code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  const zip = async () => {
    const { default: JSZip } = await import('jszip');
    const z = new JSZip();
    const mark = (code: string, kind: 'html' | 'css' | 'liquid', sid?: string) => (markers ? withMarker(code, kind, source(sid)) : code);
    z.file('index.html', mark(exportHtml(doc, doc.roots, { fullDocument: true, inlineCss: false }), 'html'));
    z.file('styles.css', mark(exportCss(doc, doc.roots), 'css'));
    const sections = z.folder('shopify/sections')!;
    const used = new Set<string>();
    for (const id of doc.roots) {
      const r = generateLiquid(doc, id, { inheritFonts });
      let fn = r.filename;
      let i = 2;
      while (used.has(fn)) fn = r.filename.replace(/\.liquid$/, `-${i++}.liquid`);
      used.add(fn);
      sections.file(fn, mark(r.code, 'liquid', id));
    }
    z.file('project.sectionforge.json', JSON.stringify(doc, null, 2));
    const blob = await z.generateAsync({ type: 'blob' });
    downloadBlob(`${slug(doc.name)}-export.zip`, blob);
    st().toast('Downloaded ZIP with HTML, CSS and all Liquid sections');
  };

  const sectionOptions = doc.roots.map((id) => (
    <option key={id} value={id}>
      {doc.nodes[id].liquid?.sectionName || doc.nodes[id].name}
    </option>
  ));

  return (
    <div className="modal-bg" onMouseDown={() => st().setModal(null)}>
      <div className="modal export" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2>Export code</h2>
            <p>Production-ready markup generated from your design.</p>
          </div>
          <button className="icon-btn" onClick={() => st().setModal(null)}>
            <X size={16} />
          </button>
        </header>
        <div className="export-body">
          <aside className="export-side">
            <div className="fmt">
              {(
                [
                  ['liquid', 'Shopify section', '.liquid + schema', ShoppingBag],
                  ['html', 'HTML', 'Semantic markup', FileCode2],
                  ['css', 'CSS', 'Responsive stylesheet', FileCode2],
                ] as const
              ).map(([id, label, sub, Icon]) => (
                <button key={id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
                  <Icon size={16} />
                  <span>
                    <b>{label}</b>
                    <small>{sub}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="export-opts">
              {tab === 'liquid' ? (
                <>
                  <label className="field-l">Section</label>
                  <select className="inp" value={liquidSection} onChange={(e) => setLiquidSection(e.target.value)}>
                    {sectionOptions}
                  </select>
                  <Switch on={inheritFonts} onChange={setInheritFonts} label="Use theme fonts" desc="Drop font-family so the section inherits the theme’s typography" />
                </>
              ) : (
                <>
                  <label className="field-l">Scope</label>
                  <select className="inp" value={scope} onChange={(e) => setScope(e.target.value)}>
                    <option value="all">Entire page</option>
                    {sectionOptions}
                  </select>
                  {tab === 'html' && (
                    <>
                      <Switch on={fullDoc} onChange={setFullDoc} label="Full HTML document" desc="Include <html>, <head> and font links" />
                      <Switch on={inlineCss} onChange={setInlineCss} label="Inline CSS" desc="Embed styles in a <style> tag" />
                    </>
                  )}
                </>
              )}
            </div>

            {tab === 'liquid' && (
              <div className="howto">
                <b>Add to your theme</b>
                <ol>
                  <li>Online Store → Themes → ⋯ → Edit code</li>
                  <li>
                    Sections → Add a new section → name it <code>{out.filename.replace('.liquid', '')}</code>
                  </li>
                  <li>Paste the code and save</li>
                  <li>In the theme editor, click “Add section” and pick “{doc.nodes[liquidSection]?.liquid?.sectionName || doc.nodes[liquidSection]?.name}”</li>
                </ol>
              </div>
            )}

            <div className="export-opts">
              <Switch on={markers} onChange={setMarkers} label="Generated-file header" desc="Marks files as generated, with a fingerprint to detect hand edits later" />
              <button className="btn btn-sm" onClick={() => checkRef.current?.click()} disabled={!doc.roots.length}>
                <FileSearch size={13} /> Check a file for hand edits…
              </button>
              <input
                ref={checkRef}
                type="file"
                hidden
                accept=".liquid,.html,.htm,.css,text/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) setCheck({ name: f.name, result: inspectFile(await f.text(), gen.code) });
                }}
              />
            </div>

            <button className="btn btn-block" onClick={zip} disabled={!doc.roots.length}>
              <FileArchive size={14} /> Download everything (.zip)
            </button>
          </aside>

          <div className="export-main">
            <div className="code-bar">
              <span className="fname">
                <FileCode2 size={13} /> {out.filename}
              </span>
              <span className="code-meta">
                {out.code.split('\n').length} lines · {(new Blob([out.code]).size / 1024).toFixed(1)} KB
              </span>
              <div className="code-actions">
                <button className="btn btn-sm" onClick={copy}>
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                </button>
                <button className="btn btn-sm" onClick={() => downloadText(out.filename, out.code)}>
                  <Download size={13} /> Download
                </button>
              </div>
            </div>
            {check && (
              <div className={`filecheck is-${check.result.status}`}>
                {check.result.status === 'unchanged' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <div>
                  <b>
                    {check.name}:{' '}
                    {check.result.status === 'unchanged'
                      ? 'untouched since it was generated'
                      : check.result.status === 'edited'
                        ? 'edited by hand after export'
                        : 'no SectionForge header (hand-written or header removed)'}
                  </b>
                  <span>
                    {check.result.vsCurrent === 0
                      ? 'It already matches what this design exports now.'
                      : `${check.result.vsCurrent} line${check.result.vsCurrent === 1 ? ' differs' : 's differ'} from the current ${tab.toUpperCase()} export${check.result.status === 'unchanged' ? ' — safe to replace.' : ' — replacing it will discard those edits.'}`}
                  </span>
                </div>
                <button className="icon-btn" onClick={() => setCheck(null)}>
                  <X size={13} />
                </button>
              </div>
            )}
            {out.notes.length > 0 && (
              <div className="notes">
                {out.notes.map((n) => (
                  <div key={n}>
                    <Info size={12} /> {n}
                  </div>
                ))}
              </div>
            )}
            {doc.roots.length ? <CodeView code={out.code} lang={out.lang} /> : <div className="code-empty">Add a section to generate code.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}