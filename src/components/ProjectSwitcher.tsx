import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, FolderOpen, LayoutGrid, Plus, Search } from 'lucide-react';
import { useStore } from '../store';
import { listProjects, type ProjectMeta } from '../projects';
import { emptyDoc } from '../doc';
import { demoDoc } from '../templates';

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

export function ProjectSwitcher() {
  const currentId = useStore((s) => s.projectId);
  const currentName = useStore((s) => s.doc.name);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const projects: ProjectMeta[] = useMemo(() => (open ? listProjects() : []), [open]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const shown = q ? projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : projects;

  const pick = (id: string) => () => {
    setOpen(false);
    if (id === currentId) return;
    if (!st().openProject(id)) st().toast('Could not open that project.');
  };

  return (
    <div className="menu project-switch" ref={ref}>
      <button className="btn btn-ghost project-switch-btn" onClick={() => setOpen(!open)} title="Switch project">
        <FolderOpen size={14} />
        <span className="project-switch-name">{currentName}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="menu-pop project-switch-pop">
          {projects.length > 6 && (
            <div className="project-switch-search">
              <Search size={13} />
              <input
                autoFocus
                placeholder="Search projects"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
              />
            </div>
          )}
          <div className="project-switch-list">
            {shown.map((p) => (
              <button key={p.id} className={p.id === currentId ? 'is-on' : ''} onClick={pick(p.id)} title={p.name}>
                <span className="project-switch-item">
                  <b>{p.name}</b>
                  <small>
                    {p.sections} section{p.sections === 1 ? '' : 's'} · edited {ago(p.updatedAt)}
                  </small>
                </span>
                {p.id === currentId && <Check size={13} className="menu-check" />}
              </button>
            ))}
            {!shown.length && <p className="project-switch-empty">{projects.length ? `No projects match “${q}”.` : 'No other projects yet.'}</p>}
          </div>
          <div className="menu-sep" />
          <button
            onClick={() => {
              setOpen(false);
              st().openNewDoc(emptyDoc());
            }}
          >
            <Plus size={14} /> New blank project
          </button>
          <button
            onClick={() => {
              setOpen(false);
              st().openNewDoc(demoDoc());
            }}
          >
            <LayoutGrid size={14} /> New demo project
          </button>
          <div className="menu-sep" />
          <button
            onClick={() => {
              setOpen(false);
              st().goHome();
            }}
          >
            <LayoutGrid size={14} /> All projects
          </button>
        </div>
      )}
    </div>
  );
}