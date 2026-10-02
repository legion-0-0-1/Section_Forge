import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, FilePlus2, FolderOpen, HardDrive, LayoutTemplate, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { deleteProject, duplicateProject, listProjects, loadProject, renameProject, storageBytes, type ProjectMeta } from '../projects';
import { migrateDoc } from '../migrate';
import { emptyDoc } from '../doc';
import { demoDoc } from '../templates';
import { exportHtml } from '../export/html';
import { downloadText, slug } from '../lib/util';
import { ask } from '../ui';
import { Logo } from './TopBar';
import { SettingsButton } from './Settings';

const st = () => useStore.getState();

function ago(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(t).toLocaleDateString();
}

const fmtBytes = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

const Thumb = memo(function Thumb({ id, updatedAt }: { id: string; updatedAt: number }) {
  const html = useMemo(() => {
    try {
      const d = loadProject(id);
      if (!d || !d.roots.length) return null;
      return exportHtml(d, d.roots.slice(0, 4), { fullDocument: true, inlineCss: true }).replace(
        '</head>',
        '<style>html,body{overflow:hidden;pointer-events:none}</style></head>',
      )
      // thumbnails are static snapshots: drop the motion runtime (the frame is script-less anyway)
      .replace(/<script>[\s\S]*?<\/script>/g, '');
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, updatedAt]);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver((e) => setScale(e[0].contentRect.width / 1280));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="pthumb" ref={box}>
      {html ? (
        <iframe srcDoc={html} title="" tabIndex={-1} loading="lazy" sandbox="" style={{ transform: `scale(${scale})` }} />
      ) : (
        <div className="pthumb-empty">
          <LayoutTemplate size={22} />
          Empty page
        </div>
      )}
    </div>
  );
});

function ProjectCard({ p, refresh }: { p: ProjectMeta; refresh: () => void }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  const act = (fn: () => void | Promise<void>) => async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenu(false);
    await fn();
    refresh();
  };

  return (
    <div className="pcard" onClick={() => !renaming && st().openProject(p.id)}>
      <Thumb id={p.id} updatedAt={p.updatedAt} />
      <div className="pcard-meta">
        {renaming ? (
          <input
            className="inp"
            autoFocus
            defaultValue={p.name}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== p.name) renameProject(p.id, v);
              setRenaming(false);
              refresh();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <div className="pcard-name" title={p.name}>
            {p.name}
          </div>
        )}
        <div className="pcard-sub">
          {p.sections} section{p.sections === 1 ? '' : 's'} · edited {ago(p.updatedAt)}
        </div>
      </div>
      <div className="pcard-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title="More" onClick={() => setMenu(!menu)}>
          <MoreHorizontal size={16} />
        </button>
        {menu && (
          <div className="menu-pop right">
            <button onClick={act(() => void st().openProject(p.id))}>
              <FolderOpen size={14} /> Open
            </button>
            <button onClick={act(() => setRenaming(true))}>
              <Pencil size={14} /> Rename
            </button>
            <button onClick={act(() => void duplicateProject(p.id))}>
              <Copy size={14} /> Duplicate
            </button>
            <button
              onClick={act(() => {
                const d = loadProject(p.id);
                if (d) downloadText(`${slug(d.name)}.sectionforge.json`, JSON.stringify(d, null, 2), 'application/json');
              })}
            >
              <Download size={14} /> Download .json
            </button>
            <div className="menu-sep" />
            <button
              className="danger"
              onClick={act(async () => {
                const ok = await ask({
                  title: `Delete “${p.name}”?`,
                  message: 'This permanently removes the project from this browser. Download it first if you might need it again.',
                  confirmLabel: 'Delete project',
                  danger: true,
                });
                if (ok) deleteProject(p.id);
              })}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Home() {
  const [projects, setProjects] = useState<ProjectMeta[]>(() => listProjects());
  const [q, setQ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => setProjects(listProjects());
  const used = useMemo(() => storageBytes(), [projects]);
  const shown = projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="home">
      <header className="home-top">
        <div className="brand">
          <Logo />
          <span>SectionForge</span>
        </div>
        <SettingsButton />
      </header>

      <main className="home-main">
        <section className="home-hero">
          <div>
            <h1>Your projects</h1>
            <p>Design sections visually, then export clean HTML, CSS or Shopify Liquid. Everything is stored in this browser.</p>
          </div>
          <div className="home-new">
            <button className="newcard" onClick={() => st().openNewDoc(emptyDoc())}>
              <span className="newcard-icon">
                <FilePlus2 size={20} />
              </span>
              <b>Blank page</b>
              <small>Start from scratch</small>
            </button>
            <button className="newcard" onClick={() => st().openNewDoc(demoDoc())}>
              <span className="newcard-icon alt">
                <LayoutTemplate size={20} />
              </span>
              <b>Demo storefront</b>
              <small>11 ready-made sections</small>
            </button>
            <button className="newcard" onClick={() => fileRef.current?.click()}>
              <span className="newcard-icon alt2">
                <FolderOpen size={20} />
              </span>
              <b>Import project</b>
              <small>From a .json file</small>
            </button>
          </div>
        </section>

        <div className="home-bar">
          <h2>
            All projects <span>{projects.length}</span>
          </h2>
          <div className="search home-search">
            <Search size={14} />
            <input placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {shown.length ? (
          <div className="pgrid">
            {shown.map((p) => (
              <ProjectCard key={p.id} p={p} refresh={refresh} />
            ))}
          </div>
        ) : (
          <div className="home-empty">{projects.length ? `No projects match “${q}”.` : 'No projects yet — start one above.'}</div>
        )}

        <footer className="home-foot">
          <HardDrive size={13} /> Using {fmtBytes(used)} of browser storage (most browsers allow ~5 MB). Download projects you want to keep safe.
        </footer>
      </main>

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
            st().openNewDoc(migrateDoc(JSON.parse(await f.text())));
          } catch (err) {
            st().toast(err instanceof Error ? err.message : 'That file is not a valid SectionForge project.');
          }
        }}
      />
    </div>
  );
}
