import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown, ChevronLeft, CircleHelp, Code2, Copy, Download, Eye, FolderOpen, LayoutGrid,
  Monitor, Redo2, Smartphone, Tablet, Undo2, Check,
} from 'lucide-react';
import { useStore } from '../store';
import { migrateDoc } from '../migrate';
import { uid } from '../lib/util';
import { SettingsButton } from './Settings';
import { useUI } from '../ui';
import { downloadText, slug } from '../lib/util';
import { ProjectSwitcher } from './ProjectSwitcher';
import { DEVICE_PRESETS } from '../lib/style';
import type { Device } from '../types';

const st = () => useStore.getState();

type ExportKind = 'export-liquid' | 'export-html' | 'export-css';

const EXPORT_ITEMS: { kind: ExportKind; label: string; sub: string }[] = [
  { kind: 'export-liquid', label: 'Shopify Liquid', sub: '.liquid + schema' },
  { kind: 'export-html', label: 'HTML', sub: 'Semantic markup' },
  { kind: 'export-css', label: 'CSS', sub: 'Responsive stylesheet' },
];

export function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a797ff" />
          <stop offset="1" stopColor="#6246ea" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#lg)" />
      <rect x="8" y="8" width="16" height="5" rx="1.5" fill="#fff" />
      <rect x="8" y="15" width="7" height="9" rx="1.5" fill="#fff" opacity=".85" />
      <rect x="17" y="15" width="7" height="9" rx="1.5" fill="#fff" opacity=".6" />
    </svg>
  );
}

function FileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="menu" ref={ref}>
      <button className="btn btn-ghost" onClick={() => setOpen(!open)}>
        File <ChevronDown size={13} />
      </button>
      {open && (
        <div className="menu-pop">
          <button onClick={act(() => st().goHome())}>
            <LayoutGrid size={14} /> All projects
          </button>
          <button
            onClick={act(() => {
              const d = st().doc;
              st().openNewDoc({ ...structuredClone(d), id: uid(), name: `${d.name} (copy)`, createdAt: Date.now() });
              st().toast('Opened a copy of this project');
            })}
          >
            <Copy size={14} /> Duplicate project
          </button>
          <div className="menu-sep" />
          <button onClick={act(() => fileRef.current?.click())}>
            <FolderOpen size={14} /> Import project (.json)
          </button>
          <button
            onClick={act(() => {
              const d = st().doc;
              downloadText(`${slug(d.name)}.sectionforge.json`, JSON.stringify(d, null, 2), 'application/json');
            })}
          >
            <Download size={14} /> Download project (.json)
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const d = migrateDoc(JSON.parse(await f.text()));
            if (st().openNewDoc(d)) st().toast(`Imported “${d.name}” as a new project`);
          } catch (err) {
            st().toast(err instanceof Error ? err.message : 'That file is not a valid SectionForge project.');
          }
        }}
      />
    </div>
  );
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastExportKind = useStore((s) => s.lastExportKind);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);
  const go = (m: ExportKind) => () => {
    setOpen(false);
    st().setModal(m);
  };
  const lastLabel = EXPORT_ITEMS.find((i) => i.kind === lastExportKind)?.label ?? 'Code';
  return (
    <div className="menu" ref={ref}>
      <button className="btn btn-accent" onClick={() => setOpen(!open)} title="Export code (Ctrl+E)">
        <Code2 size={14} /> Export {lastLabel} <ChevronDown size={12} />
      </button>
      {open && (
        <div className="menu-pop right">
          {EXPORT_ITEMS.map(({ kind, label, sub }) => (
            <button key={kind} onClick={go(kind)}>
              <Code2 size={14} />
              <span>
                <b>{label}</b>
                <small>{sub}</small>
              </span>
              {kind === lastExportKind && <Check size={13} className="menu-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Preset menu shown only when a tablet/mobile class is active. */
function DevicePresetMenu() {
  const device = useStore((s) => s.device);
  const preset = useStore((s) => s.devicePreset);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  if (device === 'desktop') return null;

  const list = DEVICE_PRESETS.filter((p) => p.kind === device);
  const current = list.find((p) => p.id === preset);
  const label = current?.label ?? (device === 'tablet' ? 'Tablet' : 'Mobile');

  return (
    <div className="menu device-menu" ref={ref}>
      <button className="btn btn-sm device-menu-btn" onClick={() => setOpen(!open)} title="Choose a device preset">
        {label} <ChevronDown size={11} />
      </button>
      {open && (
        <div className="menu-pop device-menu-pop">
          <button
            className={!preset ? 'is-on' : ''}
            onClick={() => {
              setOpen(false);
              st().setDevicePreset(null);
            }}
          >
            <span className="device-menu-item">
              <b>Class default</b>
              <small>{device === 'tablet' ? '768' : '390'} px</small>
            </span>
            {!preset && <Check size={13} className="menu-check" />}
          </button>
          <div className="menu-sep" />
          {list.map((p) => (
            <button
              key={p.id}
              className={preset === p.id ? 'is-on' : ''}
              onClick={() => {
                setOpen(false);
                st().setDevicePreset(p.id);
              }}
            >
              <span className="device-menu-item">
                <b>{p.label}</b>
                <small>{p.width} px</small>
              </span>
              {preset === p.id && <Check size={13} className="menu-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const device = useStore((s) => s.device);
  const name = useStore((s) => s.doc.name);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const startTutorial = useUI((s) => s.startTutorial);
  const devices: { id: Device; icon: typeof Monitor; label: string }[] = [
    { id: 'desktop', icon: Monitor, label: 'Desktop' },
    { id: 'tablet', icon: Tablet, label: 'Tablet' },
    { id: 'mobile', icon: Smartphone, label: 'Mobile' },
  ];
  return (
    <header className="top">
      <div className="top-l">
        <button className="brand brand-btn" onClick={() => st().goHome()} title="All projects">
          <ChevronLeft size={15} className="brand-back" />
          <Logo />
        </button>
        <span className="top-sep" />
        <ProjectSwitcher />
        <input className="doc-name" value={name} onChange={(e) => st().setDocName(e.target.value)} spellCheck={false} />
        <FileMenu />
      </div>
      <div className="top-c">
        <div className="seg seg-dev">
          {devices.map((d) => (
            <button key={d.id} className={device === d.id ? 'is-on' : ''} onClick={() => st().setDevice(d.id)} title={d.label}>
              <d.icon size={15} />
            </button>
          ))}
        </div>
        <DevicePresetMenu />
        <div className="undo">
          <button className="icon-btn" disabled={!canUndo} onClick={() => st().undo()} title="Undo (Ctrl+Z)">
            <Undo2 size={15} />
          </button>
          <button className="icon-btn" disabled={!canRedo} onClick={() => st().redo()} title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={15} />
          </button>
        </div>
      </div>
      <div className="top-r">
        <button className="icon-btn" title="Take the tour" onClick={() => startTutorial(0)}>
          <CircleHelp size={15} />
        </button>
        <ModeToggle />
        <SettingsButton />
        <span className="top-sep" />
        <button className="btn" onClick={() => st().setModal('preview')}>
          <Eye size={14} /> Preview
        </button>
        <ExportMenu />
      </div>
    </header>
  );
}

function ModeToggle() {
  const mode = useUI((s) => s.mode);
  const setMode = useUI((s) => s.setMode);
  return (
    <div className="seg seg-mode" title="Simple hides technical controls; Developer shows everything">
      <button className={mode === 'simple' ? 'is-on' : ''} onClick={() => setMode('simple')}>
        Simple
      </button>
      <button className={mode === 'developer' ? 'is-on' : ''} onClick={() => setMode('developer')}>
        Developer
      </button>
    </div>
  );
}