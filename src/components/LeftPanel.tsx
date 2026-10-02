import { memo, useMemo, useState } from 'react';
import { Boxes, ChevronRight, Eye, EyeOff, Layers, LayoutTemplate, Plus, Repeat, Search, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { PALETTE } from '../palette';
import { TEMPLATES } from '../templates';
import { ELEMENTS, isContainer, TEXT_TYPES } from '../registry';
import { docFromSpecs } from '../doc';
import { exportHtml } from '../export/html';
import { beginTouchDrag, layerDragOver, performDrop, setDragGhost } from '../dnd';
import type { TreeSpec } from '../types';

const st = () => useStore.getState();

function startNewDrag(e: React.DragEvent, spec: TreeSpec, label: string) {
  e.dataTransfer.setData('text/plain', label);
  e.dataTransfer.effectAllowed = 'copy';
  setDragGhost(e, `+ ${label}`);
  st().startDrag({ kind: 'new', spec, label });
}

function ElementsTab() {
  return (
    <div className="lp-scroll">
      <p className="lp-hint">Drag onto the canvas, or click to insert after the selection.</p>
      {PALETTE.map((g) => (
        <div key={g.title} className="lp-group">
          <div className="lp-group-title">{g.title}</div>
          <div className="tiles">
            {g.items.map((it) => (
              <button
                key={it.id}
                className="tile"
                draggable
                onDragStart={(e) => startNewDrag(e, it.spec(), it.label)}
                onDragEnd={() => st().endDrag()}
                onPointerDown={(e) => beginTouchDrag(e, () => ({ kind: 'new', spec: it.spec(), label: it.label }), `+ ${it.label}`)}
                onClick={() => st().addSpecSmart(it.spec())}
              >
                <it.icon size={18} strokeWidth={1.6} />
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const TemplateThumb = memo(function TemplateThumb({ spec }: { spec: TreeSpec }) {
  const html = useMemo(() => {
    const d = docFromSpecs([spec]);
    return exportHtml(d, d.roots, { fullDocument: true, inlineCss: true }).replace(
      '</head>',
      '<style>html,body{overflow:hidden;pointer-events:none}</style></head>',
    )
      // thumbnails are static snapshots: drop the motion runtime (the frame is script-less anyway)
      .replace(/<script>[\s\S]*?<\/script>/g, '');
  }, [spec]);
  return (
    <div className="thumb">
      <iframe srcDoc={html} title="preview" tabIndex={-1} loading="lazy" sandbox="allow-same-origin" />
    </div>
  );
});

function SectionsTab() {
  const [q, setQ] = useState('');
  const specs = useMemo(() => Object.fromEntries(TEMPLATES.map((t) => [t.id, t.spec()])), []);
  const list = TEMPLATES.filter((t) => (t.name + ' ' + t.category).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="lp-scroll">
      <div className="search">
        <Search size={14} />
        <input placeholder="Search sections" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="tpl-list">
        {list.map((t) => (
          <div
            key={t.id}
            className="tpl"
            draggable
            onDragStart={(e) => startNewDrag(e, t.spec(), t.name)}
            onDragEnd={() => st().endDrag()}
            onPointerDown={(e) => beginTouchDrag(e, () => ({ kind: 'new', spec: t.spec(), label: t.name }), `+ ${t.name}`, 300)}
            onClick={() => st().addSpecSmart(t.spec())}
            title="Click to insert · drag to position"
          >
            <TemplateThumb spec={specs[t.id]} />
            <div className="tpl-meta">
              <span className="tpl-name">{t.name}</span>
              <span className="tpl-cat">{t.category}</span>
            </div>
            <span className="tpl-add">
              <Plus size={14} />
            </span>
          </div>
        ))}
        {!list.length && <p className="lp-hint">No sections match “{q}”.</p>}
      </div>
    </div>
  );
}

function LayerRow({ id, depth }: { id: string; depth: number }) {
  const node = useStore((s) => s.doc.nodes[id]);
  const selected = useStore((s) => s.selectedId === id || s.multi.includes(id));
  const hovered = useStore((s) => s.hoverId === id);
  const collapsed = useStore((s) => !!s.collapsed[id]);
  const device = useStore((s) => s.device);
  const drop = useStore((s) => (s.dropHint?.source === 'layers' && s.dropHint.layerTarget === id ? s.dropHint.layerPos : null));
  const [renaming, setRenaming] = useState(false);
  if (!node) return null;
  const Icon = ELEMENTS[node.type].icon;
  const hasKids = node.children.length > 0;
  const hidden = !!node.hidden?.[device];
  const snippet =
    TEXT_TYPES.has(node.type) && node.name === ELEMENTS[node.type].label ? String(node.props.text || '').slice(0, 40) : '';

  return (
    <>
      <div
        className={`layer${selected ? ' is-sel' : ''}${hovered ? ' is-hov' : ''}${drop ? ' drop-' + drop : ''}${hidden ? ' is-hidden' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        data-layer-id={id}
        draggable={!renaming}
        onPointerDown={(e) => !renaming && beginTouchDrag(e, () => ({ kind: 'move', id }), `Move · ${node.name}`, 350)}
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', id);
          e.dataTransfer.effectAllowed = 'move';
          setDragGhost(e, `Move · ${node.name}`);
          st().startDrag({ kind: 'move', id });
        }}
        onDragEnd={() => st().endDrag()}
        onDragOver={(e) => layerDragOver(e, id)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          performDrop();
        }}
        onClick={(e) => st().select(id, !(e.shiftKey || e.ctrlKey || e.metaKey), e.shiftKey || e.ctrlKey || e.metaKey)}
        onDoubleClick={() => setRenaming(true)}
        onMouseEnter={() => st().setHover(id)}
        onMouseLeave={() => st().setHover(null)}
      >
        <span
          className={`caret${hasKids ? '' : ' is-empty'}${collapsed ? '' : ' is-open'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasKids) st().toggleCollapsed(id);
          }}
        >
          {hasKids && <ChevronRight size={12} />}
        </span>
        <Icon size={13} className="layer-icon" />
        {renaming ? (
          <input
            className="layer-input"
            autoFocus
            defaultValue={node.name}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== node.name) st().updateNode(id, { name: v });
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setRenaming(false);
              e.stopPropagation();
            }}
          />
        ) : (
          <span className="layer-name">
            {node.name}
            {snippet && <em> · {snippet}</em>}
          </span>
        )}
        {node.liquid?.blocks && isContainer(node.type) && (
          <span className="layer-badge" title="Children export as repeatable Shopify blocks">
            <Repeat size={10} />
          </span>
        )}
        <button
          className={`layer-eye${hidden ? ' on' : ''}`}
          title={hidden ? `Hidden on ${device}` : `Hide on ${device}`}
          onClick={(e) => {
            e.stopPropagation();
            st().updateNode(id, { hidden: { ...node.hidden, [device]: !hidden } });
          }}
        >
          {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button
          className="layer-eye layer-del"
          title={`Delete ${node.name}`}
          aria-label={`Delete ${node.name}`}
          onClick={(e) => {
            e.stopPropagation();
            void st().requestRemove([id]);
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      {!collapsed && node.children.map((c) => <LayerRow key={c} id={c} depth={depth + 1} />)}
    </>
  );
}

function LayersTab() {
  const roots = useStore((s) => s.doc.roots);
  return (
    <div className="lp-scroll layers" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && st().setDropHint(null)}>
      {roots.map((id) => (
        <LayerRow key={id} id={id} depth={0} />
      ))}
      {!roots.length && <p className="lp-hint">Nothing here yet. Add a section to get started.</p>}
      <p className="lp-hint small">Double-click to rename · drag to reorder</p>
    </div>
  );
}

export function LeftPanel() {
  const tab = useStore((s) => s.leftTab);
  const tabs = [
    { id: 'elements', label: 'Elements', icon: Boxes },
    { id: 'sections', label: 'Sections', icon: LayoutTemplate },
    { id: 'layers', label: 'Layers', icon: Layers },
  ] as const;
  return (
    <aside className="left">
      <div className="ptabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => st().setLeftTab(t.id)}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'elements' && <ElementsTab />}
      {tab === 'sections' && <SectionsTab />}
      {tab === 'layers' && <LayersTab />}
    </aside>
  );
}
