import type { Doc } from './types';
import { migrateDoc } from './migrate';
import { demoDoc } from './templates';
import { uid } from './lib/util';

/**
 * Project storage (browser localStorage — no server).
 *   sectionforge:projects        → ProjectMeta[] (index, cheap to list)
 *   sectionforge:project:<id>    → full Doc JSON
 */
const INDEX_KEY = 'sectionforge:projects';
const docKey = (id: string) => `sectionforge:project:${id}`;
const LEGACY_KEY = 'sectionforge:doc:v1';
const SEEDED_KEY = 'sectionforge:seeded';

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sections: number;
  elements: number;
  bytes: number;
}

function readIndex(): ProjectMeta[] {
  try {
    const v = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeIndex(list: ProjectMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

const metaOf = (d: Doc, bytes: number): ProjectMeta => ({
  id: d.id,
  name: d.name,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
  sections: d.roots.length,
  elements: Object.keys(d.nodes).length,
  bytes,
});

export function listProjects(): ProjectMeta[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProject(id: string): Doc | null {
  const raw = localStorage.getItem(docKey(id));
  if (!raw) return null;
  return migrateDoc(JSON.parse(raw));
}

/** Persist a project. Returns false when browser storage is full. */
export function saveProject(doc: Doc): boolean {
  const json = JSON.stringify(doc);
  try {
    localStorage.setItem(docKey(doc.id), json);
    const list = readIndex().filter((p) => p.id !== doc.id);
    list.push(metaOf(doc, json.length * 2));
    writeIndex(list);
    return true;
  } catch {
    return false;
  }
}

export function deleteProject(id: string) {
  localStorage.removeItem(docKey(id));
  writeIndex(readIndex().filter((p) => p.id !== id));
}

export function renameProject(id: string, name: string) {
  const d = loadProject(id);
  if (!d) return;
  d.name = name;
  d.updatedAt = Date.now();
  saveProject(d);
}

export function duplicateProject(id: string): Doc | null {
  const d = loadProject(id);
  if (!d) return null;
  const now = Date.now();
  const copy: Doc = { ...d, id: uid(), name: `${d.name} (copy)`, createdAt: now, updatedAt: now };
  return saveProject(copy) ? copy : null;
}

/** Store an imported/new doc as a fresh project (always a new id so nothing is overwritten). */
export function addProject(doc: Doc): Doc | null {
  const now = Date.now();
  const d: Doc = { ...doc, id: listProjects().some((p) => p.id === doc.id) ? uid() : doc.id, updatedAt: now };
  return saveProject(d) ? d : null;
}

/** Approximate bytes used by SectionForge in localStorage (UTF-16). */
export function storageBytes(): number {
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith('sectionforge:')) n += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
  }
  return n;
}

/** One-time: adopt the pre-projects single autosave, and seed a demo for first-time users. */
export function bootstrapProjects() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const d = migrateDoc(JSON.parse(legacy));
      if (saveProject(d)) localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* unreadable legacy data — leave it in place */
  }
  if (!localStorage.getItem(SEEDED_KEY)) {
    if (!readIndex().length) saveProject(demoDoc());
    localStorage.setItem(SEEDED_KEY, '1');
  }
}
/** Cheap lookup for the project switcher: reads only the index, not the doc blob. */
export function getProjectMeta(id: string): ProjectMeta | null {
  return readIndex().find((p) => p.id === id) ?? null;
}