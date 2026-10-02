import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FONTS, googleFontsHref } from '../lib/fonts';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { motionVars } from '../export/css';
import { RUNTIME_CSS } from '../export/runtime';
import { previewEntrances } from '../lib/motion';
import { colorTokenVars, findTextStyle, resolveWithTextStyle } from '../lib/tokens';
import type { BNode } from '../types';
import { ArrowDown, ArrowUp, Copy, CornerLeftUp, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import { useStore, type Rect } from '../store';
import { ELEMENTS, TEXT_TYPES, tagOf } from '../registry';
import { DEVICE_PRESETS, DEVICE_WIDTH, resolveStyle } from '../lib/style';
import { ICONS } from '../lib/icons';
import { parseVideo } from '../lib/video';
import { beginTouchDrag, canvasDragOver, performDrop, setDragGhost } from '../dnd';
import { PALETTE } from '../palette';
import { Sparkles } from 'lucide-react';

const idFrom = (t: EventTarget | null): string | null =>
  ((t as HTMLElement | null)?.closest?.('[data-ss-id]') as HTMLElement | null)?.getAttribute('data-ss-id') ?? null;

const lines = (t: string) => {
  const parts = String(t ?? '').split('\n');
  return parts.map((p, i) => (
    <span key={i}>
      {p}
      {i < parts.length - 1 && <br />}
    </span>
  ));
};

/**
 * Custom HTML is untrusted (it can come from an imported project), so it never touches the
 * editor's DOM. It renders in an iframe sandboxed WITHOUT allow-scripts: <script> tags and inline
 * handlers (onerror=…) are inert. allow-same-origin only lets us measure its height.
 */
function EmbedFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(48);
  const page = useStore((s) => s.doc.page);
  const fonts = useMemo(() => googleFontsHref(FONTS.map((f) => f.name)), []);
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8">${fonts ? `<link rel="stylesheet" href="${fonts}">` : ''}<style>html,body{margin:0;font-family:${page.fontFamily};color:${page.color};overflow:hidden}*{box-sizing:border-box}img{max-width:100%}</style></head><body>${html}</body></html>`;

  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const b = f.contentDocument?.body;
      if (!b) return;
      setH(Math.max(24, Math.ceil(b.scrollHeight)));
      ro?.disconnect();
      ro = new ResizeObserver(() => setH(Math.max(24, Math.ceil(b.scrollHeight))));
      ro.observe(b);
    };
    f.addEventListener('load', measure);
    return () => {
      f.removeEventListener('load', measure);
      ro?.disconnect();
    };
  }, [srcDoc]);

  return (
    <iframe
      ref={ref}
      title="Custom HTML (sandboxed)"
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      style={{ display: 'block', width: '100%', height: h, border: 0, pointerEvents: 'none', colorScheme: 'normal' }}
    />
  );
}

function SliderView({ node, common }: { node: BNode; common: Record<string, any> }) {
  const track = useRef<HTMLDivElement>(null);
  const device = useStore((s) => s.device);
  const empty = node.children.length === 0;
  const per = Math.max(1, +(node.props.perView?.[device] ?? node.props.perView?.desktop ?? 1));
  const pages = Math.max(1, node.children.length - Math.floor(per) + 1);
  const scroll = (dir: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const t = track.current;
    const first = t?.children[0] as HTMLElement | undefined;
    if (t && first) t.scrollBy({ left: dir * (first.getBoundingClientRect().width + (parseFloat(getComputedStyle(t).columnGap) || 0)), behavior: 'smooth' });
  };
  return (
    <div
      {...common}
      className={`ss-slider${empty ? ' ss-empty' : ''}`}
      data-arrows={node.props.arrows ? '' : undefined}
      data-dots={node.props.dots ? '' : undefined}
    >
      {!empty && (
        <>
          <div className="ss-slider-viewport">
            <div className="ss-slider-track" ref={track}>
              {node.children.map((c) => (
                <NodeView key={c} id={c} />
              ))}
            </div>
            <button type="button" className="ss-slider-btn ss-prev" onClick={scroll(-1)} aria-label="Previous slide">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="ss-slider-btn ss-next" onClick={scroll(1)} aria-label="Next slide">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="ss-slider-dots">
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" aria-current={i === 0 ? 'true' : 'false'} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const NodeView = memo(function NodeView({ id }: { id: string }) {
  const node = useStore((s) => s.doc.nodes[id]);
  const device = useStore((s) => s.device);
  const hoverPreview = useStore((s) => s.styleState === 'hover' && s.selectedId === id);
  const editing = useStore((s) => s.editingId === id);
  const anyEditing = useStore((s) => s.editingId !== null);
  const textStyle = useStore((s) => findTextStyle(s.doc, s.doc.nodes[id]?.textStyle));
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
    el.innerText = node?.props.text ?? '';
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!node) return null;
  const mv = motionVars(node);
  const style = {
    ...resolveWithTextStyle(node, textStyle, device, hoverPreview),
    ...mv.desktop,
    ...(device !== 'desktop' ? mv.tablet : {}),
    ...(device === 'mobile' ? mv.mobile : {}),
  } as CSSProperties;
  if (node.hidden?.[device]) style.display = 'none';
  const Tag: any = tagOf(node);
  const common: Record<string, any> = {
    'data-ss-id': id,
    style,
    draggable: !anyEditing,
    id: node.htmlId || undefined,
  };

  switch (node.type) {
    case 'section':
    case 'container':
    case 'row':
    case 'grid': {
      const empty = node.children.length === 0;
      return (
        <Tag {...common} className={empty ? 'ss-empty' : undefined}>
          {node.children.map((c) => (
            <NodeView key={c} id={c} />
          ))}
        </Tag>
      );
    }
    case 'marquee': {
      const empty = node.children.length === 0;
      const copies = Math.max(1, Math.min(6, +node.props.copies || 2));
      const kids = node.children.map((c) => <NodeView key={c} id={c} />);
      // Only the first copy is "real" (selectable); the rest are inert visual clones.
      const clone = (k: number) => (
        <div key={k} className="ss-clone" aria-hidden>
          {kids}
        </div>
      );
      return (
        <div
          {...common}
          className={`ss-marquee${empty ? ' ss-empty' : ''}`}
          data-dir={node.props.direction === 'right' ? 'right' : 'left'}
          data-pause={node.props.pauseOnHover ? '' : undefined}
        >
          {!empty && (
            <div className="ss-mq-track">
              <div className="ss-mq-group">
                {kids}
                {Array.from({ length: copies - 1 }, (_, k) => clone(k))}
              </div>
              <div className="ss-mq-group" aria-hidden>
                {Array.from({ length: copies }, (_, k) => clone(k + 10))}
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'slider':
      return <SliderView node={node} common={common} />;
    case 'heading':
    case 'text':
    case 'button':
    case 'link': {
      const isLink = node.type === 'button' || node.type === 'link';
      if (editing) {
        const done = (el: HTMLElement) => {
          const text = el.innerText.replace(/\n$/, '');
          const s = useStore.getState();
          if (text !== node.props.text) s.updateProps(id, { text });
          s.setEditing(null);
        };
        return (
          <Tag
            {...common}
            key="editing"
            ref={ref}
            className="ss-editing"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e: React.FocusEvent<HTMLElement>) => done(e.currentTarget)}
            onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
              e.stopPropagation();
              if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey && node.type !== 'text')) {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        );
      }
      return (
        <Tag {...common} key="view" href={isLink ? node.props.href || '#' : undefined}>
          {lines(node.props.text)}
        </Tag>
      );
    }
    case 'list':
      return (
        <Tag {...common}>
          {(node.props.items || []).map((it: string, i: number) => (
            <li key={i}>{it}</li>
          ))}
        </Tag>
      );
    case 'icon': {
      const I = ICONS[node.props.icon] ?? Sparkles;
      return (
        <span {...common}>
          <I size={node.props.size ?? 22} strokeWidth={node.props.stroke ?? 1.75} aria-hidden />
        </span>
      );
    }
    case 'image':
      return <img {...common} src={node.props.src || undefined} alt={node.props.alt || ''} />;
    case 'video': {
      const v = parseVideo(node.props.url);
      const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, objectFit: 'cover', pointerEvents: 'none' };
      return (
        <div {...common}>
          {(v.kind === 'youtube' || v.kind === 'vimeo') && <iframe src={v.embed} title={node.name} style={fill} />}
          {v.kind === 'file' && <video src={v.src} style={fill} muted playsInline preload="metadata" />}
        </div>
      );
    }
    case 'embed':
      return (
        <div {...common}>
          <EmbedFrame html={node.props.html || ''} />
        </div>
      );
    case 'divider':
      return <hr {...common} />;
    case 'spacer':
      return <div {...common} className="ss-spacer" />;
  }
});

function Overlay({ frameWidth }: { frameWidth: number }) {
  const [rects, setRects] = useState<{ sel: Rect | null; hov: Rect | null; multi: Rect[] }>({ sel: null, hov: null, multi: [] });
  const last = useRef('');
  const selNode = useStore((s) => (s.selectedId ? s.doc.nodes[s.selectedId] : null));
  const hovNode = useStore((s) => (s.hoverId ? s.doc.nodes[s.hoverId] : null));
  const dropHint = useStore((s) => s.dropHint);
  const dragging = useStore((s) => s.dragging);
  const editing = useStore((s) => s.editingId);
  const siblings = useStore((s) => {
    const n = s.selectedId ? s.doc.nodes[s.selectedId] : null;
    if (!n) return null;
    const arr = n.parent ? s.doc.nodes[n.parent]?.children : s.doc.roots;
    return arr ? `${arr.indexOf(n.id)}/${arr.length}` : null;
  });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const frame = document.querySelector('.ss-frame');
      const st = useStore.getState();
      if (frame) {
        const f = frame.getBoundingClientRect();
        const m = (id: string | null): Rect | null => {
          if (!id) return null;
          const el = frame.querySelector(`[data-ss-id="${id}"]`);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          if (!r.width && !r.height) return null;
          return { x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height };
        };
        const next = {
          sel: m(st.selectedId),
          hov: st.hoverId !== st.selectedId && !st.dragging ? m(st.hoverId) : null,
          multi: st.multi.map(m).filter((r): r is Rect => !!r),
        };
        const key = JSON.stringify(next);
        if (key !== last.current) {
          last.current = key;
          setRects(next);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { sel, hov, multi } = rects;
  const multiCount = useStore((s) => s.multi.length);
  const box = (r: Rect): CSSProperties => ({ left: r.x, top: r.y, width: r.w, height: r.h });
  const [idx, total] = (siblings || '0/0').split('/').map(Number);
  const s = useStore.getState();

  return (
    <div className="ov">
      {multi.map((r, i) => (
        <div key={i} className="ov-multi" style={box(r)} />
      ))}
      {hov && hovNode && (
        <div className="ov-hover" style={box(hov)}>
          <span className="ov-tag ov-tag-hover" style={{ top: hov.y < 20 ? 0 : -20 }}>
            {hovNode.name}
          </span>
        </div>
      )}
      {sel && selNode && (
        <div className={`ov-sel${editing ? ' is-editing' : ''}`} style={box(sel)}>
          {!dragging && !editing && (
            <div
              className="ov-bar"
              style={{
                top: sel.y < 30 ? 4 : -28,
                left: Math.max(-sel.x, Math.min(0, frameWidth - 300 - sel.x)),
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="ov-name">
                {(() => {
                  const I = ELEMENTS[selNode.type].icon;
                  return <I size={12} />;
                })()}
                {multiCount ? `${multiCount + 1} selected` : selNode.name}
              </span>
              {selNode.parent && (
                <button title="Select parent (Esc)" onClick={() => s.select(selNode.parent)}>
                  <CornerLeftUp size={13} />
                </button>
              )}
              <button title="Move up" disabled={idx <= 0} onClick={() => s.moveSibling(selNode.id, -1)}>
                <ArrowUp size={13} />
              </button>
              <button title="Move down" disabled={idx >= total - 1} onClick={() => s.moveSibling(selNode.id, 1)}>
                <ArrowDown size={13} />
              </button>
              <button title="Duplicate (Ctrl+D)" onClick={() => s.duplicateMany(s.selection())}>
                <Copy size={13} />
              </button>
              <button title="Delete (Del)" className="danger" onClick={() => void s.requestRemove()}>
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      )}
      {dragging && dropHint?.source === 'canvas' && dropHint.rect && (
        <div className={dropHint.box ? 'ov-drop-box' : 'ov-drop-line'} style={box(dropHint.rect)} />
      )}
    </div>
  );
}

function EmptyState() {
  const s = useStore.getState();
  return (
    <div className="empty-state" onClick={(e) => e.stopPropagation()}>
      <div className="empty-icon">
        <LayoutTemplate size={26} />
      </div>
      <h3>Start with a section</h3>
      <p>Drag elements or ready-made sections here, or start from a blank section.</p>
      <div className="empty-actions">
        <button className="btn btn-accent" onClick={() => s.setLeftTab('sections')}>
          <LayoutTemplate size={14} /> Browse sections
        </button>
        <button className="btn" onClick={() => s.addSpecSmart(PALETTE[0].items[0].spec())}>
          <Plus size={14} /> Blank section
        </button>
      </div>
    </div>
  );
}

export function Canvas() {
  const roots = useStore((s) => s.doc.roots);
  const device = useStore((s) => s.device);
  const page = useStore((s) => s.doc.page);
  const colors = useStore((s) => s.doc.tokens.colors);
  const tokenVars = useMemo(() => colorTokenVars({ tokens: { colors, text: [] } } as any), [colors]);
  const reveal = useStore((s) => s.reveal);
  const frameRef = useRef<HTMLDivElement>(null);
  const devicePreset = useStore((s) => s.devicePreset);
  /**
   * Measurement sentinel: an absolutely-positioned, zero-height, width:100% element inside
   * `.canvas`. Its width tracks the canvas's content box and is NOT affected by the frame's
   * own width or by scrollbar appearance/disappearance — which is what caused the previous
   * "desktop view keeps expanding/contracting" feedback loop.
   */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(DEVICE_WIDTH.desktop);
  const [play, setPlay] = useState(false);

  // The motion runtime's styles (marquee, slider, …) also drive the canvas; the `.ss-js` gate
  // is never set in the editor, so entrance animations never hide anything here.
  useEffect(() => {
    if (document.getElementById('ss-runtime-css')) return;
    const style = document.createElement('style');
    style.id = 'ss-runtime-css';
    style.textContent = RUNTIME_CSS;
    document.head.appendChild(style);
  }, []);

  const togglePlay = () => {
    const next = !play;
    setPlay(next);
    if (next) {
      const d = useStore.getState().doc;
      d.roots.forEach((r) => previewEntrances(d, r));
    }
  };

  // Measure the sentinel once + on real resizes. Only commit changes > 1px to avoid jitter.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      setAvail((prev) => (Math.abs(w - prev) > 1 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

    // Render at the real device width and zoom the frame down to fit the viewport.
  // A named preset (iPhone 15, iPad Pro…) overrides the class default width.
  const presetWidth = devicePreset ? DEVICE_PRESETS.find((p) => p.id === devicePreset)?.width : undefined;
  const base = device === 'desktop' ? Math.max(DEVICE_WIDTH.desktop, avail) : presetWidth ?? DEVICE_WIDTH[device];
  const zoom = Math.min(1, (avail - 2) / base);
  const frameWidth = base * zoom;

  useEffect(() => {
    if (!reveal) return;
    requestAnimationFrame(() => {
      const el = frameRef.current?.querySelector(`[data-ss-id="${reveal.id}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [reveal]);

  const st = () => useStore.getState();
  const label = device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablet' : 'Mobile';

  return (
    <main
      ref={undefined}
      className="canvas"
      onClick={() => st().select(null)}
      onDragOver={(e) => {
        // allow dropping below the frame (append at end)
        if (st().dragging) canvasDragOver(e, null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        performDrop();
      }}
    >
      {/* width sentinel — never affected by the frame's width */}
      <div ref={sentinelRef} className="canvas-measure" aria-hidden />
      <div className="canvas-inner" style={{ width: frameWidth }}>
        <div className="frame-label">
          <span>
            {label} · {base}px
          </span>
          {zoom < 1 && <span className="zoom-pill">{Math.round(zoom * 100)}%</span>}
          <button
            className={`play-btn${play ? ' is-on' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            title="Play entrance animations and marquees on the canvas"
          >
            {play ? <Pause size={11} /> : <Play size={11} />} {play ? 'Stop motion' : 'Play motion'}
          </button>
        </div>
        <div className="frame-wrap">
          <div
            ref={frameRef}
            className={`ss-frame${device !== 'desktop' ? ' is-device' : ''}${play ? ' ss-play' : ''}`}
            style={{
              width: base,
              zoom,
              ...tokenVars,
              fontFamily: page.fontFamily,
              color: page.color,
              background: page.background,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const id = idFrom(e.target);
              if (id && id === st().editingId) return;
              st().select(id, false, e.shiftKey || e.ctrlKey || e.metaKey);
            }}
            onDoubleClick={(e) => {
              const id = idFrom(e.target);
              const n = id ? st().doc.nodes[id] : null;
              if (n && TEXT_TYPES.has(n.type)) st().setEditing(id);
            }}
            onMouseOver={(e) => !st().dragging && st().setHover(idFrom(e.target))}
            onMouseLeave={() => st().setHover(null)}
            onDragStart={(e) => {
              const id = idFrom(e.target);
              if (!id) return;
              e.stopPropagation();
              e.dataTransfer.setData('text/plain', id);
              e.dataTransfer.effectAllowed = 'move';
              setDragGhost(e, `Move · ${st().doc.nodes[id]?.name}`);
              st().startDrag({ kind: 'move', id });
            }}
            onDragEnd={() => st().endDrag()}
            onPointerDown={(e) => {
              // touch: long-press an element to pick it up
              const id = idFrom(e.target);
              if (id && !st().editingId) beginTouchDrag(e, () => ({ kind: 'move', id }), `Move · ${st().doc.nodes[id]?.name}`, 450);
            }}
            onDragOver={(e) => canvasDragOver(e, idFrom(e.target))}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) st().setDropHint(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              performDrop();
            }}
          >
            {roots.map((id) => (
              <NodeView key={id} id={id} />
            ))}
            {!roots.length && <EmptyState />}
          </div>
          <Overlay frameWidth={frameWidth} />
        </div>
      </div>
    </main>
  );
}