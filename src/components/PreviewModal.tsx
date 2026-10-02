import { useMemo, useState } from 'react';
import { ExternalLink, Monitor, Smartphone, Tablet, X } from 'lucide-react';
import { useStore } from '../store';
import { exportHtml } from '../export/html';
import type { Device } from '../types';

/** Scripts may run (animations, sliders, embeds) but in an opaque origin — never same-origin. */
const SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';

const WIDTHS: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };

export function PreviewModal() {
  const doc = useStore((s) => s.doc);
  const [device, setDevice] = useState<Device>(useStore.getState().device);
  const html = useMemo(() => exportHtml(doc, doc.roots, { fullDocument: true, inlineCss: true }), [doc]);
  const close = () => useStore.getState().setModal(null);
  const openTab = () => {
    // A blob: URL would share the editor's origin (and its localStorage), so the page is wrapped
    // in an opaque-origin sandboxed iframe: scripts run, but can't reach the editor.
    const attr = html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const wrapper = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${doc.page.title.replace(/</g, '&lt;')} — preview</title><style>html,body{margin:0;height:100%}iframe{display:block;border:0;width:100%;height:100%}</style></head><body><iframe sandbox="${SANDBOX}" srcdoc="${attr}"></iframe></body></html>`;
    const url = URL.createObjectURL(new Blob([wrapper], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const devices: [Device, typeof Monitor][] = [
    ['desktop', Monitor],
    ['tablet', Tablet],
    ['mobile', Smartphone],
  ];
  return (
    <div className="preview">
      <header className="preview-bar">
        <span className="preview-title">Preview · {doc.page.title || doc.name}</span>
        <div className="seg seg-dev">
          {devices.map(([d, I]) => (
            <button key={d} className={device === d ? 'is-on' : ''} onClick={() => setDevice(d)} title={d}>
              <I size={15} />
            </button>
          ))}
        </div>
        <div className="preview-actions">
          <button className="btn" onClick={openTab}>
            <ExternalLink size={14} /> Open in new tab
          </button>
          <button className="icon-btn" onClick={close} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>
      </header>
      <div className="preview-stage">
        <iframe title="Preview" sandbox={SANDBOX} srcDoc={html} style={{ width: WIDTHS[device] }} className={device !== 'desktop' ? 'is-device' : ''} />
      </div>
    </div>
  );
}
